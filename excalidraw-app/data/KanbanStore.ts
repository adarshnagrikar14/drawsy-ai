import { randomId } from "@excalidraw/common";

const KANBAN_STORAGE_KEY = "drawsy-kanban-board-v1";
const KANBAN_ACTIVE_KEY = "drawsy-kanban-active-v1";

export type KanbanCard = {
  id: string;
  title: string;
  assignee?: string;
  progress?: number;
  priority?: "low" | "medium" | "high" | null;
  createdAt: number;
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
    ],
    cards: {},
    roughness: 1,
    createdAt: now,
    updatedAt: now,
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

export const loadKanbanBoard = (): KanbanBoard => {
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
        };
      }
    }
  } catch {
    // A damaged or unavailable local store must not block the workspace.
  }
  return createKanbanBoard();
};

export const saveKanbanBoard = (board: KanbanBoard) => {
  try {
    window.localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(board));
  } catch {
    // The board remains usable for this session when storage is unavailable.
  }
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
