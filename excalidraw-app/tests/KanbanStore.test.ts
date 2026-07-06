import { clear, createStore, get } from "idb-keyval";

import {
  createKanbanBoard,
  loadKanbanBoardAsync,
  saveKanbanBoard,
  setKanbanScope,
} from "../data/KanbanStore";

const store = createStore("drawsy-kanban-db", "kanban-store");

describe("KanbanStore", () => {
  beforeEach(async () => {
    await clear(store);
    window.localStorage.clear();
    setKanbanScope(null);
  });

  afterEach(async () => {
    await clear(store);
    window.localStorage.clear();
  });

  it("persists the board asynchronously in IndexedDB", async () => {
    const board = { ...createKanbanBoard(), title: "Saved board" };
    await saveKanbanBoard(board);

    await expect(loadKanbanBoardAsync()).resolves.toMatchObject({
      id: board.id,
      title: "Saved board",
    });
    expect(window.localStorage.getItem("drawsy-kanban-board-v1")).toBeNull();
  });

  it("migrates the valid legacy board once and removes it after commit", async () => {
    const board = { ...createKanbanBoard(), title: "Legacy board" };
    window.localStorage.setItem(
      "drawsy-kanban-board-v1",
      JSON.stringify(board),
    );

    const migrated = await loadKanbanBoardAsync();

    expect(migrated).toMatchObject({ id: board.id, title: "Legacy board" });
    expect(window.localStorage.getItem("drawsy-kanban-board-v1")).toBeNull();
    await expect(loadKanbanBoardAsync()).resolves.toMatchObject({
      id: board.id,
      title: "Legacy board",
    });
  });

  it("keeps inactive boards cached when another board becomes active", async () => {
    const first = { ...createKanbanBoard(), title: "First" };
    const second = { ...createKanbanBoard(), title: "Second" };
    await saveKanbanBoard(first);
    await saveKanbanBoard(second);

    await expect(loadKanbanBoardAsync()).resolves.toMatchObject({
      id: second.id,
      title: "Second",
    });
    await expect(get(`board:guest:${first.id}`, store)).resolves.toMatchObject({
      id: first.id,
      title: "First",
    });
  });

  it("isolates cached boards between authenticated users", async () => {
    setKanbanScope("user-one");
    const first = { ...createKanbanBoard(), title: "User one" };
    await saveKanbanBoard(first);

    setKanbanScope("user-two");
    const second = { ...createKanbanBoard(), title: "User two" };
    await saveKanbanBoard(second);
    await expect(loadKanbanBoardAsync()).resolves.toMatchObject({
      id: second.id,
      title: "User two",
    });

    setKanbanScope("user-one");
    await expect(loadKanbanBoardAsync()).resolves.toMatchObject({
      id: first.id,
      title: "User one",
    });
  });

  it("ignores damaged legacy data without blocking Kanban", async () => {
    window.localStorage.setItem("drawsy-kanban-board-v1", "not-json");

    const board = await loadKanbanBoardAsync();

    expect(board.schemaVersion).toBe(1);
    expect(board.columns).toHaveLength(4);
  });
});
