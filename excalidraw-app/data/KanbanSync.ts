import { randomId } from "@excalidraw/common";
import { createStore, get, set } from "idb-keyval";

import { KanbanApiError } from "./KanbanApi";

import { ensureOgColumns } from "./KanbanStore";

import type {
  KanbanApi,
  KanbanCommand,
  KanbanCommandResult,
  RemoteKanbanCard,
  RemoteKanbanChange,
  RemoteKanbanRole,
  RemoteKanbanSnapshot,
} from "./KanbanApi";
import type { KanbanBoard, KanbanCard } from "./KanbanStore";

const syncStore = createStore("drawsy-kanban-db", "kanban-store");
const PUSH_DELAY = 250;
const MAX_RECONNECT_DELAY = 30_000;
const MAX_PENDING_RETRY_AGE = 6 * 24 * 60 * 60 * 1000;

type PendingBatch = {
  commands: KanbanCommand[];
  createdAt: number;
};

type PersistedSyncState = {
  schemaVersion: 1;
  clientId: string;
  clientSequence: number;
  snapshot: RemoteKanbanSnapshot;
  pendingBatch: PendingBatch | null;
};

export type KanbanSyncStatus =
  | "local"
  | "pending"
  | "syncing"
  | "synced"
  | "offline"
  | "conflict"
  | "error";

export class KanbanSyncConflictError extends Error {
  constructor(readonly results: KanbanCommandResult[]) {
    super("Kanban changes require conflict resolution.");
    this.name = "KanbanSyncConflictError";
  }
}

export class KanbanBoardSelectionRequiredError extends Error {
  constructor() {
    super("Choose whether to keep this local board or open a cloud board.");
    this.name = "KanbanBoardSelectionRequiredError";
  }
}

const isPristineLocalBoard = (board: KanbanBoard) =>
  board.createdAt === board.updatedAt &&
  Object.keys(board.cards).length === 0 &&
  board.title === "My Kanban" &&
  same(
    board.columns.map((column) => column.title),
    ["Not started", "In progress", "Done", "In review"],
  );

const alignColumnIds = (
  local: KanbanBoard,
  snapshot: RemoteKanbanSnapshot,
): KanbanBoard => {
  const remoteColumns = snapshot.columns.filter((c) => c.deletedAt === null);
  const updatedColumns = local.columns.map((col) => {
    const match = remoteColumns.find((r) => r.title === col.title);
    if (match && match.id !== col.id) {
      return {
        ...col,
        id: match.id,
      };
    }
    return col;
  });
  return {
    ...local,
    columns: updatedColumns,
  };
};

const syncKey = (userId: string, boardId: string) =>
  `sync:${userId}:${boardId}`;

const cardPayload = (card: KanbanCard) => ({
  title: card.title,
  description: card.description || "",
  priority: card.priority || null,
  progress: card.progress || 0,
  dueDate: card.dueAt || null,
  legacyAssigneeText: card.assignee?.trim() || null,
  legacyCanvasTags: card.canvasTags || [],
});

const cardSyncPayload = (card: KanbanCard) => ({
  ...cardPayload(card),
  assigneeIds: card.assigneeIds || [],
});

const checklistFor = (snapshot: RemoteKanbanSnapshot, cardId: string) =>
  snapshot.checklistItems
    .filter((item) => item.cardId === cardId && item.deletedAt === null)
    .sort((first, second) => compareRanks(first.rank, second.rank));

const compareRanks = (first: string, second: string) =>
  first < second ? -1 : first > second ? 1 : 0;

const canvasLinksFor = (snapshot: RemoteKanbanSnapshot, cardId: string) =>
  snapshot.canvasLinks.filter(
    (link) =>
      link.cardId === cardId &&
      typeof link.canvasId === "string" &&
      typeof link.id === "string",
  );

export const remoteSnapshotToKanbanBoard = (
  snapshot: RemoteKanbanSnapshot,
): KanbanBoard => {
  const activeColumns = snapshot.columns
    .filter((column) => column.deletedAt === null)
    .sort((first, second) => compareRanks(first.rank, second.rank));
  const activeCards = snapshot.cards.filter((card) => card.deletedAt === null);
  return ensureOgColumns({
    schemaVersion: 1,
    id: snapshot.board.id,
    title: snapshot.board.title,
    roughness: snapshot.board.roughness,
    cardRadius: snapshot.board.cardRadius,
    isLocked: snapshot.board.isLocked,
    members: snapshot.members,
    createdAt: snapshot.board.createdAt,
    updatedAt: snapshot.board.updatedAt,
    columns: activeColumns.map((column) => ({
      id: column.id,
      title: column.title,
      cardIds: activeCards
        .filter((card) => card.columnId === column.id)
        .sort((first, second) => compareRanks(first.rank, second.rank))
        .map((card) => card.id),
    })),
    cards: Object.fromEntries(
      activeCards.map((card) => [
        card.id,
        {
          id: card.id,
          title: card.title,
          assignee: card.legacyAssigneeText || undefined,
          assigneeIds: card.assigneeIds,
          progress: card.progress,
          priority: card.priority,
          description: card.description,
          dueAt: card.dueDate,
          canvasTags: card.legacyCanvasTags,
          canvasLinks: canvasLinksFor(snapshot, card.id).map((link) => ({
            id: link.id,
            canvasId: link.canvasId,
            title: link.title,
            state: link.state,
            createdAt: link.createdAt,
          })),
          checklist: checklistFor(snapshot, card.id).map((item) => ({
            id: item.id,
            title: item.title,
            completed: item.completed,
          })),
          createdAt: card.createdAt,
          updatedAt: card.updatedAt,
        } as KanbanCard,
      ]),
    ),
  });
};

const resolveNeighbors = (
  desiredIds: string[],
  index: number,
  existingSet: Set<string>,
) => {
  let beforeId: string | null = null;
  for (let i = index - 1; i >= 0; i--) {
    if (existingSet.has(desiredIds[i])) {
      beforeId = desiredIds[i];
      break;
    }
  }
  let afterId: string | null = null;
  for (let i = index + 1; i < desiredIds.length; i++) {
    if (existingSet.has(desiredIds[i])) {
      afterId = desiredIds[i];
      break;
    }
  }
  return { beforeId, afterId };
};

const reconcileMoves = (
  currentIds: string[],
  desiredIds: string[],
  createCommand: (
    id: string,
    beforeId: string | null,
    afterId: string | null,
  ) => KanbanCommand,
  existingSet: Set<string>,
) => {
  const simulated = currentIds.filter((id) => desiredIds.includes(id));
  const commands: KanbanCommand[] = [];
  desiredIds.forEach((id, index) => {
    if (!simulated.includes(id)) {
      simulated.splice(index, 0, id);
      return;
    }
    if (simulated[index] === id) {
      return;
    }
    simulated.splice(simulated.indexOf(id), 1);
    simulated.splice(index, 0, id);
    const adjacent = resolveNeighbors(desiredIds, index, existingSet);
    commands.push(createCommand(id, adjacent.beforeId, adjacent.afterId));
  });
  return commands;
};

const same = (first: unknown, second: unknown) =>
  JSON.stringify(first) === JSON.stringify(second);

const hasBoardLockedFailure = (results: KanbanCommandResult[]) =>
  results.some(
    (result) => result.status === "rejected" && result.code === "board_locked",
  );

export const createKanbanCommands = (
  snapshot: RemoteKanbanSnapshot,
  desired: KanbanBoard,
  nextIdentity: () => { operationId: string; clientSequence: number },
) => {
  const commands: KanbanCommand[] = [];
  const command = (
    type: string,
    rest: Omit<
      KanbanCommand,
      "type" | "operationId" | "clientSequence" | "knownBoardRevision"
    >,
  ): KanbanCommand => ({
    ...nextIdentity(),
    knownBoardRevision: snapshot.board.revision,
    type,
    ...rest,
  });
  const desiredBoardPayload = {
    title: desired.title,
    roughness: desired.roughness,
    cardRadius: desired.cardRadius ?? 1,
    isLocked: !!desired.isLocked,
  };
  const remoteBoardPayload = {
    title: snapshot.board.title,
    roughness: snapshot.board.roughness,
    cardRadius: snapshot.board.cardRadius,
    isLocked: snapshot.board.isLocked,
  };
  const boardPayload = Object.fromEntries(
    Object.entries(desiredBoardPayload).filter(
      ([field, value]) =>
        !same(
          value,
          remoteBoardPayload[field as keyof typeof remoteBoardPayload],
        ),
    ),
  );
  if (Object.keys(boardPayload).length > 0) {
    commands.push(command("updateBoard", { payload: boardPayload }));
    if (snapshot.board.isLocked && boardPayload.isLocked === false) {
      return commands;
    }
  }

  const remoteColumns = new Map(
    snapshot.columns.map((column) => [column.id, column]),
  );
  const desiredColumnIds = desired.columns.map((column) => column.id);
  const activeRemoteColumns = snapshot.columns
    .filter((column) => column.deletedAt === null)
    .sort((first, second) => compareRanks(first.rank, second.rank));
  const existingColumns = new Set(
    activeRemoteColumns.map((column) => column.id),
  );

  desired.columns.forEach((column, index) => {
    const remote = remoteColumns.get(column.id);
    if (!remote) {
      commands.push(
        command("createColumn", {
          entityId: column.id,
          payload: {
            title: column.title,
            ...resolveNeighbors(desiredColumnIds, index, existingColumns),
          },
        }),
      );
      existingColumns.add(column.id);
    } else if (remote.deletedAt !== null) {
      commands.push(
        command("restoreColumn", {
          entityId: column.id,
          baseVersion: remote.version,
          payload: { destinationColumnId: null },
        }),
      );
      existingColumns.add(column.id);
    }
  });

  commands.push(
    ...reconcileMoves(
      activeRemoteColumns.map((column) => column.id),
      desiredColumnIds,
      (id, beforeId, afterId) => {
        const remote = remoteColumns.get(id)!;
        const desiredColumn = desired.columns.find(
          (column) => column.id === id,
        )!;
        return command("moveColumn", {
          entityId: id,
          baseVersion: remote.version,
          payload: {
            beforeId,
            afterId,
            ...(remote.title !== desiredColumn.title
              ? { title: desiredColumn.title }
              : {}),
          },
        });
      },
      existingColumns,
    ),
  );

  for (const column of desired.columns) {
    const remote = remoteColumns.get(column.id);
    if (remote && remote.title !== column.title) {
      const alreadyMoves = commands.some(
        (candidate) =>
          candidate.type === "moveColumn" && candidate.entityId === column.id,
      );
      if (!alreadyMoves) {
        commands.push(
          command("updateColumn", {
            entityId: column.id,
            baseVersion: remote.version,
            payload: { title: column.title },
          }),
        );
      }
    }
  }

  const activeRemoteCards = snapshot.cards.filter(
    (card) => card.deletedAt === null,
  );
  const existingCards = new Set(activeRemoteCards.map((card) => card.id));

  const remoteCards = new Map(snapshot.cards.map((card) => [card.id, card]));
  const desiredCardIds = new Set(Object.keys(desired.cards));
  for (const column of desired.columns) {
    column.cardIds.forEach((id, index) => {
      const card = desired.cards[id];
      if (!card || remoteCards.has(id)) {
        return;
      }
      commands.push(
        command("createCard", {
          entityId: id,
          payload: {
            ...cardPayload(card),
            columnId: column.id,
            assigneeIds: card.assigneeIds || [],
            ...resolveNeighbors(column.cardIds, index, existingCards),
          },
        }),
      );
      existingCards.add(id);
    });
  }

  const simulatedByColumn = new Map<string, string[]>();
  desired.columns.forEach((column) => {
    simulatedByColumn.set(
      column.id,
      snapshot.cards
        .filter(
          (card) =>
            card.deletedAt === null &&
            card.columnId === column.id &&
            desiredCardIds.has(card.id),
        )
        .sort((first, second) => compareRanks(first.rank, second.rank))
        .map((card) => card.id),
    );
  });
  for (const column of desired.columns) {
    column.cardIds.forEach((id, index) => {
      const remote = remoteCards.get(id);
      if (
        remote &&
        remote.deletedAt === null &&
        remote.columnId !== column.id
      ) {
        commands.push(
          command("moveCard", {
            entityId: id,
            baseVersion: remote.version,
            payload: {
              columnId: column.id,
              ...resolveNeighbors(column.cardIds, index, existingCards),
            },
          }),
        );
      }
    });
    commands.push(
      ...reconcileMoves(
        simulatedByColumn.get(column.id) || [],
        column.cardIds,
        (id, beforeId, afterId) => {
          const remote = remoteCards.get(id)!;
          return command("moveCard", {
            entityId: id,
            baseVersion: remote.version,
            payload: { columnId: column.id, beforeId, afterId },
          });
        },
        existingCards,
      ).filter((candidate) => {
        const remote = remoteCards.get(candidate.entityId!);
        const desiredColumn = desired.columns.find((entry) =>
          entry.cardIds.includes(candidate.entityId!),
        );
        return remote && remote.columnId === desiredColumn?.id;
      }),
    );
  }

  for (const [id, card] of Object.entries(desired.cards)) {
    const remote = remoteCards.get(id);
    if (!remote) {
      continue;
    }
    if (remote.deletedAt !== null) {
      commands.push(
        command("restoreCard", {
          entityId: id,
          baseVersion: remote.version,
          payload: {},
        }),
      );
      existingCards.add(id);
      continue;
    }
    const payload = cardSyncPayload(card);
    const fields = Object.keys(payload).filter(
      (field) =>
        !same(
          payload[field as keyof typeof payload],
          remote[field as keyof RemoteKanbanCard],
        ),
    );
    if (fields.length > 0) {
      commands.push(
        command("updateCard", {
          entityId: id,
          baseFieldVersions: Object.fromEntries(
            fields.map((field) => [field, remote.fieldVersions[field] || 0]),
          ),
          payload: Object.fromEntries(
            fields.map((field) => [
              field,
              payload[field as keyof typeof payload],
            ]),
          ),
        }),
      );
    }
  }

  for (const remote of snapshot.cards) {
    if (remote.deletedAt === null && !desired.cards[remote.id]) {
      commands.push(
        command("deleteCard", {
          entityId: remote.id,
          baseVersion: remote.version,
          payload: {},
        }),
      );
    }
  }

  const activeRemoteChecklist = snapshot.checklistItems.filter(
    (item) => item.deletedAt === null,
  );
  const existingChecklist = new Set(
    activeRemoteChecklist.map((item) => item.id),
  );

  const remoteChecklist = new Map(
    snapshot.checklistItems.map((item) => [item.id, item]),
  );
  for (const card of Object.values(desired.cards)) {
    const desiredItems = card.checklist || [];
    desiredItems.forEach((item, index) => {
      if (!remoteChecklist.has(item.id)) {
        commands.push(
          command("createChecklistItem", {
            entityId: item.id,
            payload: {
              cardId: card.id,
              title: item.title,
              ...resolveNeighbors(
                desiredItems.map((candidate) => candidate.id),
                index,
                existingChecklist,
              ),
            },
          }),
        );
        existingChecklist.add(item.id);
      }
    });
    const remoteItems = checklistFor(snapshot, card.id);
    commands.push(
      ...reconcileMoves(
        remoteItems.map((item) => item.id),
        desiredItems.map((item) => item.id),
        (id, beforeId, afterId) => {
          const remote = remoteChecklist.get(id)!;
          return command("moveChecklistItem", {
            entityId: id,
            baseVersion: remote.version,
            payload: { beforeId, afterId },
          });
        },
        existingChecklist,
      ).filter((candidate) => remoteChecklist.has(candidate.entityId!)),
    );
    for (const item of desiredItems) {
      const remote = remoteChecklist.get(item.id);
      if (!remote) {
        continue;
      }
      const payload: Record<string, unknown> = {};
      const baseFieldVersions: Record<string, number> = {};
      if (item.title !== remote.title) {
        payload.title = item.title;
        baseFieldVersions.title = remote.fieldVersions.title || 0;
      }
      if (item.completed !== remote.completed) {
        payload.completed = item.completed;
        baseFieldVersions.completed = remote.fieldVersions.completed || 0;
      }
      if (Object.keys(payload).length > 0) {
        commands.push(
          command("updateChecklistItem", {
            entityId: item.id,
            baseFieldVersions,
            payload,
          }),
        );
      }
    }
  }

  const desiredChecklistIds = new Set(
    Object.values(desired.cards).flatMap((card) =>
      (card.checklist || []).map((item) => item.id),
    ),
  );
  for (const remote of snapshot.checklistItems) {
    if (remote.deletedAt === null && !desiredChecklistIds.has(remote.id)) {
      commands.push(
        command("deleteChecklistItem", {
          entityId: remote.id,
          baseVersion: remote.version,
          payload: {},
        }),
      );
    }
  }

  const remoteCanvasLinks = new Map(
    snapshot.canvasLinks
      .filter(
        (link) =>
          typeof link.id === "string" &&
          typeof link.cardId === "string" &&
          typeof link.canvasId === "string",
      )
      .map((link) => [link.id, link]),
  );
  const keptRemoteCanvasLinkIds = new Set<string>();
  for (const card of Object.values(desired.cards)) {
    for (const link of card.canvasLinks || []) {
      if (remoteCanvasLinks.has(link.id)) {
        keptRemoteCanvasLinkIds.add(link.id);
        continue;
      }
      const duplicateRemote = [...remoteCanvasLinks.values()].find(
        (remote) =>
          remote.cardId === card.id && remote.canvasId === link.canvasId,
      );
      if (duplicateRemote) {
        keptRemoteCanvasLinkIds.add(duplicateRemote.id);
        continue;
      }
      commands.push(
        command("createCanvasLink", {
          entityId: link.id,
          payload: { cardId: card.id, canvasId: link.canvasId },
        }),
      );
    }
  }
  for (const remote of remoteCanvasLinks.values()) {
    if (
      !desired.cards[remote.cardId] ||
      !keptRemoteCanvasLinkIds.has(remote.id)
    ) {
      commands.push(
        command("deleteCanvasLink", {
          entityId: remote.id,
          payload: {},
        }),
      );
    }
  }

  for (const remote of activeRemoteColumns) {
    if (!desiredColumnIds.includes(remote.id)) {
      commands.push(
        command("deleteColumn", {
          entityId: remote.id,
          baseVersion: remote.version,
          payload: { destinationColumnId: null },
        }),
      );
    }
  }
  return commands;
};

const applyChanges = (
  snapshot: RemoteKanbanSnapshot,
  changes: RemoteKanbanChange[],
  latestRevision: number,
) => {
  const next = structuredClone(snapshot);
  for (const change of changes) {
    if (change.entityType === "board") {
      Object.assign(next.board, change.value);
      continue;
    }
    const collection =
      change.entityType === "column"
        ? next.columns
        : change.entityType === "card"
        ? next.cards
        : change.entityType === "checklist"
        ? next.checklistItems
        : next.canvasLinks;
    const index = collection.findIndex((item) => item.id === change.entityId);
    if (index >= 0) {
      collection[index] = change.value as never;
    } else {
      collection.push(change.value as never);
    }
  }
  next.board.revision = latestRevision;
  return next;
};

export class KanbanSync {
  private state: PersistedSyncState | null = null;
  private desired: KanbanBoard | null = null;
  private userId: string | null = null;
  private pushTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private reconnectDelay = 1_000;
  private pushRetryDelay = 1_000;
  private stopEvents: (() => void) | null = null;
  private stopped = false;
  private localDirty = false;
  private recoveringBoardLocked = false;
  private operation: Promise<void> = Promise.resolve();

  constructor(
    private readonly api: KanbanApi,
    private readonly onBoard: (board: KanbanBoard) => void,
    private readonly onStatus: (status: KanbanSyncStatus) => void,
    private readonly onRole: (role: RemoteKanbanRole) => void,
  ) {}

  private readonly handleOnline = () => {
    if (!this.stopped) {
      this.connectEvents();
      void this.refresh().catch(() => undefined);
    }
  };

  private readonly handleVisibility = () => {
    if (document.hidden) {
      this.stopEvents?.();
      this.stopEvents = null;
      return;
    }
    if (!this.stopped) {
      this.connectEvents();
      void this.refresh().catch(() => undefined);
    }
  };

  async initialize(userId: string, local: KanbanBoard) {
    this.userId = userId;
    this.desired = local;
    const boards = await this.api.listBoards();
    const exact = boards.find((board) => board.id === local.id);
    let snapshot: RemoteKanbanSnapshot;
    if (exact) {
      snapshot = await this.api.getSnapshot(local.id);
      local = alignColumnIds(local, snapshot);
      this.desired = local;
      this.onBoard(local);
    } else if (boards.length === 0) {
      const first = local.columns[0];
      if (!first) {
        throw new Error("Kanban board must contain a column");
      }
      snapshot = await this.api.createBoard({
        id: local.id,
        title: local.title,
        initialColumnId: first.id,
        initialColumnTitle: first.title,
        columns: local.columns.map((column) => ({
          id: column.id,
          title: column.title,
        })),
      });
    } else if (isPristineLocalBoard(local)) {
      const latest = [...boards].sort(
        (firstBoard, secondBoard) =>
          secondBoard.updatedAt - firstBoard.updatedAt,
      )[0]!;
      snapshot = await this.api.getSnapshot(latest.id);
      this.desired = remoteSnapshotToKanbanBoard(snapshot);
      this.onBoard(this.desired);
    } else {
      throw new KanbanBoardSelectionRequiredError();
    }

    const persisted = await get<PersistedSyncState>(
      syncKey(userId, snapshot.board.id),
      syncStore,
    );
    this.state =
      persisted?.schemaVersion === 1
        ? { ...persisted, snapshot }
        : {
            schemaVersion: 1,
            clientId: randomId(),
            clientSequence: 0,
            snapshot,
            pendingBatch: null,
          };
    this.localDirty = !!this.state.pendingBatch;
    if (!persisted) {
      this.localDirty = !exact || local.updatedAt > snapshot.board.updatedAt;
    } else if (!this.localDirty) {
      this.localDirty = this.hasLocalDifferences();
    }
    this.onRole(snapshot.board.role);
    await this.persist();
    window.addEventListener("online", this.handleOnline);
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.connectEvents();
    await this.withCloudLock(() => this.flush());
    if (!this.hasLocalDifferences()) {
      const canonical = remoteSnapshotToKanbanBoard(this.state.snapshot);
      this.desired = canonical;
      this.onBoard(canonical);
    }
    this.onStatus("synced");
    return this.desired;
  }

  queue(board: KanbanBoard) {
    this.desired = board;
    this.localDirty = true;
    this.onStatus(navigator.onLine ? "pending" : "offline");
    if (this.pushTimer !== null) {
      window.clearTimeout(this.pushTimer);
    }
    this.pushTimer = window.setTimeout(() => {
      this.pushTimer = null;
      void this.enqueue(() => this.flush()).catch(() => undefined);
    }, PUSH_DELAY);
  }

  refresh() {
    return this.enqueue(async () => {
      await this.pullChanges();
      await this.flush();
    });
  }

  stop() {
    this.stopped = true;
    window.removeEventListener("online", this.handleOnline);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.stopEvents?.();
    this.stopEvents = null;
    if (this.pushTimer !== null) {
      window.clearTimeout(this.pushTimer);
    }
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
    }
  }

  private enqueue(task: () => Promise<void>) {
    const lockedTask = () => this.withCloudLock(task);
    this.operation = this.operation.then(lockedTask, lockedTask);
    return this.operation;
  }

  private async withCloudLock(task: () => Promise<void>) {
    if (!this.state || !this.userId || !navigator.locks) {
      return task();
    }
    const boardId = this.state.snapshot.board.id;
    return navigator.locks.request(
      `drawsy-kanban-cloud:${this.userId}:${boardId}`,
      async () => {
        const persisted = await get<PersistedSyncState>(
          syncKey(this.userId!, boardId),
          syncStore,
        );
        if (
          persisted?.schemaVersion === 1 &&
          (persisted.pendingBatch ||
            persisted.snapshot.board.revision >=
              (this.state?.snapshot.board.revision || 0))
        ) {
          this.state = persisted;
          if (!this.localDirty) {
            const canonical = remoteSnapshotToKanbanBoard(persisted.snapshot);
            this.desired = canonical;
            this.onBoard(canonical);
          }
        }
        return task();
      },
    );
  }

  private nextIdentity() {
    if (!this.state) {
      throw new Error("Kanban sync is not initialized");
    }
    this.state.clientSequence += 1;
    return {
      operationId: randomId(),
      clientSequence: this.state.clientSequence,
    };
  }

  private hasLocalDifferences() {
    return !!(
      this.state &&
      this.desired &&
      createKanbanCommands(this.state.snapshot, this.desired, () => ({
        operationId: "comparison",
        clientSequence: 0,
      })).length
    );
  }

  private async flush() {
    if (!this.state || !this.desired || this.stopped) {
      return;
    }
    if (!this.localDirty && !this.state.pendingBatch) {
      this.onStatus("synced");
      return;
    }
    if (!navigator.onLine) {
      this.onStatus("offline");
      return;
    }
    this.onStatus("syncing");
    if (
      this.state.pendingBatch &&
      Date.now() - this.state.pendingBatch.createdAt > MAX_PENDING_RETRY_AGE
    ) {
      this.state.pendingBatch = null;
      await this.pullChanges();
      await this.persist();
    }
    if (!this.state.pendingBatch) {
      const commands = createKanbanCommands(
        this.state.snapshot,
        this.desired,
        () => this.nextIdentity(),
      );
      if (commands.length === 0) {
        const canonical = remoteSnapshotToKanbanBoard(this.state.snapshot);
        this.desired = canonical;
        this.onBoard(canonical);
        this.localDirty = false;
        this.onStatus("synced");
        return;
      }
      this.state.pendingBatch = { commands, createdAt: Date.now() };
      await this.persist();
    }
    try {
      const results = await this.api.applyCommands(
        this.state.snapshot.board.id,
        this.state.clientId,
        this.state.pendingBatch.commands,
      );
      const failures = results.filter(
        (result) =>
          result.status === "conflict" || result.status === "rejected",
      );
      this.state.pendingBatch = null;
      await this.pullChanges();
      await this.persist();
      if (failures.length > 0) {
        if (hasBoardLockedFailure(failures) && !this.recoveringBoardLocked) {
          await this.recoverFromBoardLocked();
          return;
        }
        this.onStatus("conflict");
        throw new KanbanSyncConflictError(failures);
      }
      this.pushRetryDelay = 1_000;
      if (this.hasLocalDifferences()) {
        await this.flush();
      } else {
        const canonical = remoteSnapshotToKanbanBoard(this.state.snapshot);
        this.desired = canonical;
        this.onBoard(canonical);
        this.localDirty = false;
        this.onStatus("synced");
      }
    } catch (error) {
      if (error instanceof KanbanSyncConflictError) {
        throw error;
      }
      if (!navigator.onLine) {
        this.onStatus("offline");
        return;
      }
      this.onStatus("error");
      if (
        error instanceof KanbanApiError &&
        error.status < 500 &&
        error.status !== 429
      ) {
        throw error;
      }
      this.schedulePushRetry();
      throw error;
    }
  }

  private async recoverFromBoardLocked() {
    if (!this.state || !this.desired) {
      return;
    }
    this.recoveringBoardLocked = true;
    try {
      this.state.snapshot = await this.api.getSnapshot(
        this.state.snapshot.board.id,
      );
      this.state.pendingBatch = null;
      await this.persist();

      if (this.state.snapshot.board.isLocked && !this.desired.isLocked) {
        const unlock = {
          ...this.nextIdentity(),
          knownBoardRevision: this.state.snapshot.board.revision,
          type: "updateBoard",
          payload: { isLocked: false },
        };
        const unlockResults = await this.api.applyCommands(
          this.state.snapshot.board.id,
          this.state.clientId,
          [unlock],
        );
        const unlockFailures = unlockResults.filter(
          (result) =>
            result.status === "conflict" || result.status === "rejected",
        );
        this.state.snapshot = await this.api.getSnapshot(
          this.state.snapshot.board.id,
        );
        await this.persist();
        if (unlockFailures.length > 0) {
          const canonical = remoteSnapshotToKanbanBoard(this.state.snapshot);
          this.desired = canonical;
          this.onBoard(canonical);
          this.localDirty = false;
          this.onStatus("conflict");
          throw new KanbanSyncConflictError(unlockFailures);
        }
      }

      if (this.hasLocalDifferences()) {
        this.localDirty = true;
        await this.flush();
        return;
      }

      const canonical = remoteSnapshotToKanbanBoard(this.state.snapshot);
      this.desired = canonical;
      this.onBoard(canonical);
      this.localDirty = false;
      this.onStatus("synced");
    } finally {
      this.recoveringBoardLocked = false;
    }
  }

  private async pullChanges() {
    if (!this.state || this.stopped) {
      return;
    }
    const remote = await this.api.getChanges(
      this.state.snapshot.board.id,
      this.state.snapshot.board.revision,
    );
    if (remote.latestRevision === this.state.snapshot.board.revision) {
      return;
    }
    if (
      remote.changes.length === 0 ||
      remote.changes.at(-1)?.revision !== remote.latestRevision
    ) {
      this.state.snapshot = await this.api.getSnapshot(
        this.state.snapshot.board.id,
      );
    } else {
      this.state.snapshot = applyChanges(
        this.state.snapshot,
        remote.changes,
        remote.latestRevision,
      );
    }
    await this.persist();
    if (!this.localDirty) {
      const canonical = remoteSnapshotToKanbanBoard(this.state.snapshot);
      this.desired = canonical;
      this.onBoard(canonical);
    }
  }

  private connectEvents() {
    if (!this.state || this.stopped || document.hidden) {
      return;
    }
    this.stopEvents?.();
    this.stopEvents = this.api.connectEvents(
      this.state.snapshot.board.id,
      (event) => {
        this.reconnectDelay = 1_000;
        if (
          event.type === "revision" &&
          event.latestRevision !== undefined &&
          event.latestRevision > (this.state?.snapshot.board.revision || 0)
        ) {
          void this.enqueue(() => this.pullChanges()).catch(() => undefined);
        }
        if (event.type === "access_revoked") {
          this.stopped = true;
          this.stopEvents?.();
          this.stopEvents = null;
          this.onStatus("error");
        }
        if (event.type === "role_changed" && event.role) {
          this.onRole(event.role);
        }
      },
      (error) => {
        if (
          this.stopped ||
          (error instanceof KanbanApiError && error.status === 403)
        ) {
          return;
        }
        this.scheduleReconnect();
      },
    );
  }

  private scheduleReconnect() {
    if (this.reconnectTimer !== null || this.stopped || document.hidden) {
      return;
    }
    const jitter = Math.floor(
      Math.random() * Math.min(1_000, this.reconnectDelay),
    );
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connectEvents();
    }, this.reconnectDelay + jitter);
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      MAX_RECONNECT_DELAY,
    );
  }

  private schedulePushRetry() {
    if (this.pushTimer !== null || this.stopped || !navigator.onLine) {
      return;
    }
    const jitter = Math.floor(
      Math.random() * Math.min(1_000, this.pushRetryDelay),
    );
    this.pushTimer = window.setTimeout(() => {
      this.pushTimer = null;
      void this.enqueue(() => this.flush()).catch(() => undefined);
    }, this.pushRetryDelay + jitter);
    this.pushRetryDelay = Math.min(
      this.pushRetryDelay * 2,
      MAX_RECONNECT_DELAY,
    );
  }

  private persist() {
    if (!this.state || !this.userId) {
      return Promise.resolve();
    }
    return set(
      syncKey(this.userId, this.state.snapshot.board.id),
      this.state,
      syncStore,
    );
  }
}
