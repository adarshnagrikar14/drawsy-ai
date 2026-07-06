import {
  createKanbanCommands,
  remoteSnapshotToKanbanBoard,
} from "../data/KanbanSync";

import type { RemoteKanbanSnapshot } from "../data/KanbanApi";
import type { KanbanBoard } from "../data/KanbanStore";

const snapshot = (): RemoteKanbanSnapshot => ({
  board: {
    id: "board-0001",
    schemaVersion: 2,
    ownerId: "user-0001",
    role: "owner",
    revision: 5,
    status: "active",
    title: "Roadmap",
    roughness: 1,
    cardRadius: 1,
    isLocked: false,
    createdAt: 1,
    updatedAt: 5,
    trashedAt: null,
  },
  columns: [
    {
      id: "column-0001",
      boardId: "board-0001",
      title: "Not started",
      rank: "1",
      version: 1,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
    },
    {
      id: "column-0002",
      boardId: "board-0001",
      title: "In progress",
      rank: "2",
      version: 1,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
    },
    {
      id: "column-0003",
      boardId: "board-0001",
      title: "In review",
      rank: "3",
      version: 1,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
    },
    {
      id: "column-0004",
      boardId: "board-0001",
      title: "Done",
      rank: "4",
      version: 1,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
    },
  ],
  cards: [
    {
      id: "card-0001",
      boardId: "board-0001",
      columnId: "column-0001",
      rank: "1",
      version: 2,
      fieldVersions: {
        title: 1,
        description: 1,
        priority: 1,
        progress: 1,
        dueDate: 1,
        legacyAssigneeText: 1,
        legacyCanvasTags: 1,
        assigneeIds: 1,
      },
      assigneeIds: [],
      title: "Task",
      description: "",
      priority: null,
      progress: 0,
      dueDate: null,
      legacyAssigneeText: null,
      legacyCanvasTags: [],
      createdBy: "user-0001",
      updatedBy: "user-0001",
      createdAt: 2,
      updatedAt: 2,
      deletedAt: null,
    },
  ],
  checklistItems: [],
  canvasLinks: [],
  members: [
    {
      userId: "user-0001",
      role: "owner",
      membershipVersion: 1,
      invitedBy: null,
      joinedAt: 1,
      updatedAt: 1,
    },
  ],
});

const identity = () => {
  let sequence = 0;
  return () => ({
    operationId: `operation-${String(++sequence).padStart(4, "0")}`,
    clientSequence: sequence,
  });
};

describe("KanbanSync reconciliation", () => {
  it("converts a canonical snapshot without creating synthetic changes", () => {
    const remote = snapshot();
    const local = remoteSnapshotToKanbanBoard(remote);

    expect(local.columns.map((column) => column.id)).toEqual([
      "column-0001",
      "column-0002",
      "column-0003",
      "column-0004",
    ]);
    expect(local.columns[0].cardIds).toEqual(["card-0001"]);
    expect(createKanbanCommands(remote, local, identity())).toEqual([]);
  });

  it("emits one move for a cross-column drag instead of rewriting both lists", () => {
    const remote = snapshot();
    const local = remoteSnapshotToKanbanBoard(remote);
    local.columns[0].cardIds = [];
    local.columns[1].cardIds = ["card-0001"];

    const commands = createKanbanCommands(remote, local, identity());

    expect(commands.filter((command) => command.type === "moveCard")).toEqual([
      expect.objectContaining({
        entityId: "card-0001",
        baseVersion: 2,
        payload: {
          columnId: "column-0002",
          beforeId: null,
          afterId: null,
        },
      }),
    ]);
  });

  it("does not loop after a card is moved above the first card", () => {
    const remote = snapshot();
    remote.columns[0].rank = "a0";
    remote.columns[1].rank = "a1";
    remote.columns[2].rank = "a2";
    remote.columns[3].rank = "a3";
    remote.cards[0].rank = "a0";
    remote.cards.push({
      ...remote.cards[0],
      id: "card-0002",
      rank: "Zz",
      version: 3,
      title: "Moved task",
    });
    const desired = remoteSnapshotToKanbanBoard(remote);

    expect(desired.columns[0].cardIds).toEqual(["card-0002", "card-0001"]);
    expect(createKanbanCommands(remote, desired, identity())).toEqual([]);
  });

  it("creates only the new card and its checklist item", () => {
    const remote = snapshot();
    const local: KanbanBoard = remoteSnapshotToKanbanBoard(remote);
    local.cards["card-0002"] = {
      id: "card-0002",
      title: "Second task",
      description: "Description",
      priority: "medium",
      progress: 30,
      dueAt: "2026-07-10",
      canvasTags: ["@canvas"],
      checklist: [{ id: "checklist-0001", title: "Review", completed: false }],
      createdAt: 6,
      updatedAt: 6,
    };
    local.columns[0].cardIds.push("card-0002");

    const commands = createKanbanCommands(remote, local, identity());

    expect(commands.map((command) => command.type)).toEqual([
      "createCard",
      "createChecklistItem",
    ]);
    expect(commands[0]).toMatchObject({
      entityId: "card-0002",
      payload: {
        title: "Second task",
        columnId: "column-0001",
        beforeId: "card-0001",
        afterId: null,
      },
    });
  });

  it("syncs real assignees and real canvas links", () => {
    const remote = snapshot();
    remote.members.push({
      userId: "user-0002",
      role: "editor",
      membershipVersion: 1,
      invitedBy: "user-0001",
      joinedAt: 2,
      updatedAt: 2,
    });
    const local = remoteSnapshotToKanbanBoard(remote);
    local.cards["card-0001"].assigneeIds = ["user-0002"];
    local.cards["card-0001"].canvasLinks = [
      {
        id: "link-0001",
        canvasId: "canvas-0001",
        title: "Launch flow",
        state: "available",
        createdAt: 6,
      },
    ];

    const commands = createKanbanCommands(remote, local, identity());

    expect(commands.map((command) => command.type)).toEqual([
      "updateCard",
      "createCanvasLink",
    ]);
    expect(commands[0]).toMatchObject({
      entityId: "card-0001",
      payload: { assigneeIds: ["user-0002"] },
    });
    expect(commands[1]).toMatchObject({
      entityId: "link-0001",
      payload: { cardId: "card-0001", canvasId: "canvas-0001" },
    });
  });

  it("removes real canvas links with a delete command", () => {
    const remote = snapshot();
    remote.canvasLinks = [
      {
        id: "link-0001",
        boardId: "board-0001",
        cardId: "card-0001",
        canvasId: "canvas-0001",
        state: "available",
        title: "Launch flow",
        createdAt: 6,
      },
    ];
    const local = remoteSnapshotToKanbanBoard(remote);
    local.cards["card-0001"].canvasLinks = [];

    const commands = createKanbanCommands(remote, local, identity());

    expect(commands).toEqual([
      expect.objectContaining({
        type: "deleteCanvasLink",
        entityId: "link-0001",
        payload: {},
      }),
    ]);
  });

  it("removes canvas links when their card is deleted", () => {
    const remote = snapshot();
    remote.canvasLinks = [
      {
        id: "link-0001",
        boardId: "board-0001",
        cardId: "card-0001",
        canvasId: "canvas-0001",
        state: "available",
        title: "Launch flow",
        createdAt: 6,
      },
    ];
    const local = remoteSnapshotToKanbanBoard(remote);
    delete local.cards["card-0001"];
    local.columns[0].cardIds = [];

    const commands = createKanbanCommands(remote, local, identity());

    expect(commands.map((command) => command.type)).toEqual([
      "deleteCard",
      "deleteCanvasLink",
    ]);
  });

  it("splits unlock into a standalone command before other edits", () => {
    const remote = snapshot();
    remote.board.isLocked = true;
    const local = remoteSnapshotToKanbanBoard(remote);
    local.isLocked = false;
    local.cards["card-0001"].title = "Edited while unlocking";

    const commands = createKanbanCommands(remote, local, identity());

    expect(commands).toEqual([
      expect.objectContaining({
        type: "updateBoard",
        payload: { isLocked: false },
      }),
    ]);
  });

  it("coalesces a column rename and reorder into one command", () => {
    const remote = snapshot();
    const local = remoteSnapshotToKanbanBoard(remote);
    local.columns = [
      local.columns[1],
      local.columns[0],
      local.columns[2],
      local.columns[3],
    ];
    local.columns[0].title = "Completed";

    const commands = createKanbanCommands(remote, local, identity());
    const columnCommands = commands.filter((command) =>
      command.type.toLowerCase().includes("column"),
    );

    expect(columnCommands).toHaveLength(1);
    expect(columnCommands[0]).toMatchObject({
      type: "moveColumn",
      entityId: "column-0002",
      payload: { title: "Completed" },
    });
  });
});
