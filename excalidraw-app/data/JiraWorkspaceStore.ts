import { createStore, get, set } from "idb-keyval";

import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";

import type { CanvasScene } from "./WorkspaceStore";

const jiraWorkspaceStore = createStore(
  "drawsy-jira-workspace-db",
  "jira-workspace-store",
);
const JIRA_WORKSPACE_KEY = "workspace";
const JIRA_WORKSPACE_ACTIVE_KEY = "drawsy-jira-workspace-active-v1";

const normalizeScene = (scene: CanvasScene): CanvasScene => ({
  elements: scene.elements || [],
  appState: {
    ...clearAppStateForLocalStorage(scene.appState || {}),
    name: "Jira Workspace",
  },
  files: scene.files || {},
});

export const JiraWorkspaceStore = {
  async load(fallback: CanvasScene): Promise<CanvasScene> {
    return normalizeScene(
      (await get<CanvasScene>(JIRA_WORKSPACE_KEY, jiraWorkspaceStore)) ||
        fallback,
    );
  },

  async save(scene: CanvasScene): Promise<void> {
    await set(JIRA_WORKSPACE_KEY, normalizeScene(scene), jiraWorkspaceStore);
  },

  loadActive(): boolean {
    try {
      return window.localStorage.getItem(JIRA_WORKSPACE_ACTIVE_KEY) === "true";
    } catch {
      return false;
    }
  },

  saveActive(active: boolean): void {
    try {
      window.localStorage.setItem(JIRA_WORKSPACE_ACTIVE_KEY, String(active));
    } catch {
      // Workspace navigation still works for this session.
    }
  },
};
