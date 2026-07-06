import { randomId } from "@excalidraw/common";
import { createStore, del, get, setMany } from "idb-keyval";

const KANBAN_STORAGE_KEY = "drawsy-kanban-board-v1";
const KANBAN_ACTIVE_KEY = "drawsy-kanban-active-v1";
const LEGACY_KANBAN_DATABASE_KEY = "board:local";
const kanbanStore = createStore("drawsy-kanban-db", "kanban-store");
let activeScope = "guest";
const scopeForUser = (userId: string | null) =>
  userId ? `user:${userId}` : "guest";
const activeBoardKey = (scope = activeScope) => `active-board:${scope}`;
const boardKey = (boardId: string, scope = activeScope) =>
  `board:${scope}:${boardId}`;

export const setKanbanScope = (userId: string | null) => {
  activeScope = scopeForUser(userId);
};

export type KanbanCard = {
  id: string;
  title: string;
  assignee?: string;
  assigneeIds?: string[];
  progress?: number;
  priority?: "low" | "medium" | "high" | null;
  description?: string;
  dueAt?: string | null;
  canvasTags?: string[];
  canvasLinks?: KanbanCanvasLink[];
  checklist?: Array<{
    id: string;
    title: string;
    completed: boolean;
  }>;
  createdAt: number;
  updatedAt: number;
};

export type KanbanCanvasLink = {
  id: string;
  canvasId: string;
  title?: string;
  state: "available" | "restricted";
  createdAt: number;
};

export type KanbanMember = {
  userId: string;
  role: "owner" | "editor" | "viewer";
  membershipVersion: number;
  invitedBy: string | null;
  joinedAt: number;
  updatedAt: number;
};

export type KanbanColumn = {
  id: string;
  title: string;
  cardIds: string[];
};

export type KanbanBoard = {
  schemaVersion: 1;
  id: string;
  title: string;
  columns: KanbanColumn[];
  cards: Record<string, KanbanCard>;
  roughness: 0 | 1 | 2;
  cardRadius?: 0 | 1 | 2;
  isLocked?: boolean;
  members?: KanbanMember[];
  createdAt: number;
  updatedAt: number;
};

const createColumn = (title: string): KanbanColumn => ({
  id: randomId(),
  title,
  cardIds: [],
});

export const createKanbanBoard = (): KanbanBoard => {
  const now = Date.now();
  return {
    schemaVersion: 1,
    id: randomId(),
    title: "My Kanban",
    columns: [
      createColumn("Not started"),
      createColumn("In progress"),
      createColumn("Done"),
      createColumn("In review"),
    ],
    cards: {},
    roughness: 1,
    cardRadius: 1,
    createdAt: now,
    updatedAt: now,
  };
};

export const ensureOgColumns = (board: KanbanBoard): KanbanBoard => {
  const ogTitles = ["Not started", "In progress", "Done", "In review"];
  const existingTitles = board.columns.map((c) => c.title);
  const missingTitles = ogTitles.filter(
    (title) => !existingTitles.includes(title),
  );
  if (missingTitles.length === 0) {
    return board;
  }
  const newColumns = [...board.columns];
  missingTitles.forEach((title) => {
    newColumns.push(createColumn(title));
  });
  return {
    ...board,
    columns: newColumns,
    updatedAt: Date.now(),
  };
};

const isKanbanBoard = (value: unknown): value is KanbanBoard => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const board = value as Partial<KanbanBoard>;
  return (
    board.schemaVersion === 1 &&
    typeof board.id === "string" &&
    typeof board.title === "string" &&
    Array.isArray(board.columns) &&
    !!board.cards &&
    typeof board.cards === "object"
  );
};

const loadLegacyKanbanBoard = (): KanbanBoard | null => {
  try {
    const stored = window.localStorage.getItem(KANBAN_STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (isKanbanBoard(parsed)) {
        return {
          ...parsed,
          roughness:
            parsed.roughness === 0 || parsed.roughness === 2
              ? parsed.roughness
              : 1,
          cardRadius:
            parsed.cardRadius === 0 || parsed.cardRadius === 2
              ? parsed.cardRadius
              : 1,
          isLocked: !!parsed.isLocked,
        };
      }
    }
  } catch {
    // A damaged or unavailable local store must not block the workspace.
  }
  return null;
};

export const loadKanbanBoard = () => ensureOgColumns(createKanbanBoard());

export const loadKanbanBoardAsync = async (): Promise<KanbanBoard> => {
  const scope = activeScope;
  try {
    const activeBoardId = await get<string>(activeBoardKey(scope), kanbanStore);
    const stored = activeBoardId
      ? await get<KanbanBoard>(boardKey(activeBoardId, scope), kanbanStore)
      : scope === "guest"
      ? await get<KanbanBoard>(LEGACY_KANBAN_DATABASE_KEY, kanbanStore)
      : null;
    if (stored && isKanbanBoard(stored)) {
      if (!activeBoardId) {
        await setMany(
          [
            [boardKey(stored.id, scope), stored],
            [activeBoardKey(scope), stored.id],
          ],
          kanbanStore,
        );
        await del(LEGACY_KANBAN_DATABASE_KEY, kanbanStore);
      }
      return ensureOgColumns({
        ...stored,
        roughness:
          stored.roughness === 0 || stored.roughness === 2
            ? stored.roughness
            : 1,
        cardRadius:
          stored.cardRadius === 0 || stored.cardRadius === 2
            ? stored.cardRadius
            : 1,
        isLocked: !!stored.isLocked,
      });
    }
  } catch {
    // Fall through to the one-time localStorage migration.
  }

  const legacy = scope === "guest" ? loadLegacyKanbanBoard() : null;
  if (legacy) {
    try {
      await setMany(
        [
          [boardKey(legacy.id, scope), legacy],
          [activeBoardKey(scope), legacy.id],
        ],
        kanbanStore,
      );
      window.localStorage.removeItem(KANBAN_STORAGE_KEY);
    } catch {
      // Keep the legacy source intact if migration cannot be durably committed.
    }
    return ensureOgColumns(legacy);
  }
  return ensureOgColumns(createKanbanBoard());
};

export const saveKanbanBoard = (board: KanbanBoard) => {
  const scope = activeScope;
  return setMany(
    [
      [boardKey(board.id, scope), board],
      [activeBoardKey(scope), board.id],
    ],
    kanbanStore,
  );
};

export const loadKanbanWorkspaceActive = () => {
  try {
    return window.localStorage.getItem(KANBAN_ACTIVE_KEY) === "true";
  } catch {
    return false;
  }
};

export const saveKanbanWorkspaceActive = (active: boolean) => {
  try {
    window.localStorage.setItem(KANBAN_ACTIVE_KEY, String(active));
  } catch {
    // Workspace navigation still works for this session.
  }
};
