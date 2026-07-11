import { clear, createStore } from "idb-keyval";

import { JiraWorkspaceStore } from "../data/JiraWorkspaceStore";

import type { CanvasScene } from "../data/WorkspaceStore";

const store = createStore("drawsy-jira-workspace-db", "jira-workspace-store");

const createScene = (name: string): CanvasScene => ({
  elements: [],
  appState: { name },
  files: {},
});

describe("JiraWorkspaceStore", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await clear(store);
  });

  afterEach(async () => {
    window.localStorage.clear();
    await clear(store);
  });

  it("persists one fixed local workspace without an index", async () => {
    await JiraWorkspaceStore.save(createScene("First"));
    await JiraWorkspaceStore.save({
      ...createScene("Second"),
      appState: { name: "Second", viewBackgroundColor: "#f5f5f5" },
    });

    const restored = await JiraWorkspaceStore.load(createScene("Fallback"));
    expect(restored.appState?.name).toBe("Jira Workspace");
    expect(restored.appState?.viewBackgroundColor).toBe("#f5f5f5");
  });

  it("keeps the active selection browser-local", () => {
    expect(JiraWorkspaceStore.loadActive()).toBe(false);
    JiraWorkspaceStore.saveActive(true);
    expect(JiraWorkspaceStore.loadActive()).toBe(true);
  });
});
