import { randomId } from "@excalidraw/common";
import { createStore, del, get, set } from "idb-keyval";

import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";

import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

const workspaceStore = createStore("drawsy-workspace-db", "workspace-store");
const WORKSPACE_INDEX_KEY = "workspace-index";
const SCHEMA_VERSION = 1;

export type CanvasDocumentMetadata = {
  id: string;
  title: string;
  projectId: string | null;
  version: number;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number;
};

export type CanvasScene = Pick<
  ImportedDataState,
  "elements" | "appState" | "files"
>;

export type CanvasDocument = CanvasDocumentMetadata & {
  scene: CanvasScene;
};

export type WorkspaceProject = {
  id: string;
  title: string;
  canvasIds: string[];
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number;
};

export type WorkspaceIndex = {
  schemaVersion: typeof SCHEMA_VERSION;
  activeCanvasId: string;
  canvases: CanvasDocumentMetadata[];
  projects: WorkspaceProject[];
};

const canvasKey = (id: string) => `canvas:${id}`;

const createId = () => randomId();

const getSceneTitle = (scene: CanvasScene) =>
  scene.appState?.name?.trim() || "Untitled";

const getUniqueCanvasTitle = (index: WorkspaceIndex, title: string) => {
  const existingTitles = new Set(
    index.canvases.map((canvas) => canvas.title.trim().toLocaleLowerCase()),
  );
  if (!existingTitles.has(title.toLocaleLowerCase())) {
    return title;
  }

  let suffix = 2;
  while (existingTitles.has(`${title} (${suffix})`.toLocaleLowerCase())) {
    suffix += 1;
  }
  return `${title} (${suffix})`;
};

const normalizeScene = (scene: CanvasScene): CanvasScene => ({
  elements: scene.elements || [],
  appState: clearAppStateForLocalStorage(scene.appState || {}),
  files: scene.files || {},
});

const createMetadata = (
  scene: CanvasScene,
  projectId: string | null,
): CanvasDocumentMetadata => {
  const now = Date.now();
  return {
    id: createId(),
    title: getSceneTitle(scene),
    projectId,
    version: 1,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  };
};

const persistDocument = async (
  metadata: CanvasDocumentMetadata,
  scene: CanvasScene,
) => {
  await set(
    canvasKey(metadata.id),
    { ...metadata, scene: normalizeScene(scene) } as CanvasDocument,
    workspaceStore,
  );
};

const getDocument = (id: string) =>
  get<CanvasDocument>(canvasKey(id), workspaceStore);

export class WorkspaceStore {
  static async initialize(initialScene: CanvasScene) {
    const existingIndex = await get<WorkspaceIndex>(
      WORKSPACE_INDEX_KEY,
      workspaceStore,
    );

    if (existingIndex?.schemaVersion === SCHEMA_VERSION) {
      const activeDocument = await getDocument(existingIndex.activeCanvasId);
      const hasActiveMetadata = existingIndex.canvases.some(
        (canvas) => canvas.id === existingIndex.activeCanvasId,
      );
      if (activeDocument && hasActiveMetadata) {
        return {
          index: existingIndex,
          document: activeDocument,
          isNewWorkspace: false,
        };
      }

      if (existingIndex.canvases.length > 0) {
        const documents = await Promise.all(
          existingIndex.canvases.map(async (canvas) => ({
            metadata: canvas,
            document: await getDocument(canvas.id),
          })),
        );
        const validDocuments = documents.filter(
          (
            entry,
          ): entry is {
            metadata: CanvasDocumentMetadata;
            document: CanvasDocument;
          } => !!entry.document,
        );

        if (validDocuments.length > 0) {
          const recovered = [...validDocuments].sort(
            (a, b) => b.metadata.lastOpenedAt - a.metadata.lastOpenedAt,
          )[0];
          const validCanvasIds = new Set(
            validDocuments.map(({ metadata }) => metadata.id),
          );
          const repairedIndex: WorkspaceIndex = {
            ...existingIndex,
            activeCanvasId: recovered.document.id,
            canvases: existingIndex.canvases.filter((canvas) =>
              validCanvasIds.has(canvas.id),
            ),
            projects: existingIndex.projects.map((project) => ({
              ...project,
              canvasIds: project.canvasIds.filter((canvasId) =>
                validCanvasIds.has(canvasId),
              ),
            })),
          };
          await set(WORKSPACE_INDEX_KEY, repairedIndex, workspaceStore);
          return {
            index: repairedIndex,
            document: recovered.document,
            isNewWorkspace: false,
          };
        }
      }
    }

    const metadata = createMetadata(initialScene, null);
    const index: WorkspaceIndex = {
      schemaVersion: SCHEMA_VERSION,
      activeCanvasId: metadata.id,
      canvases: [metadata],
      projects: [],
    };

    await persistDocument(metadata, initialScene);
    await set(WORKSPACE_INDEX_KEY, index, workspaceStore);

    return {
      index,
      document: { ...metadata, scene: normalizeScene(initialScene) },
      isNewWorkspace: true,
    };
  }

  static async importCanvas(scene: CanvasScene) {
    const workspace = await this.initialize(scene);
    if (workspace.isNewWorkspace) {
      return workspace;
    }

    const title = getUniqueCanvasTitle(workspace.index, getSceneTitle(scene));
    return this.createCanvas(workspace.index, {
      ...scene,
      appState: { ...scene.appState, name: title },
    });
  }

  static async saveCanvas(
    index: WorkspaceIndex,
    canvasId: string,
    scene: {
      elements: ImportedDataState["elements"];
      appState: AppState;
      files: BinaryFiles;
    },
  ): Promise<WorkspaceIndex> {
    const metadata = index.canvases.find((canvas) => canvas.id === canvasId);
    if (!metadata) {
      return index;
    }

    const nextMetadata: CanvasDocumentMetadata = {
      ...metadata,
      title: getSceneTitle(scene),
      version: metadata.version + 1,
      updatedAt: Date.now(),
    };
    const nextIndex = {
      ...index,
      canvases: index.canvases.map((canvas) =>
        canvas.id === canvasId ? nextMetadata : canvas,
      ),
    };

    await persistDocument(nextMetadata, scene);
    await set(WORKSPACE_INDEX_KEY, nextIndex, workspaceStore);
    return nextIndex;
  }

  static async createCanvas(
    index: WorkspaceIndex,
    scene: CanvasScene,
    projectId: string | null = null,
  ) {
    const metadata = createMetadata(scene, projectId);
    const now = Date.now();
    const nextIndex: WorkspaceIndex = {
      ...index,
      activeCanvasId: metadata.id,
      canvases: [...index.canvases, metadata],
      projects: index.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              canvasIds: [...project.canvasIds, metadata.id],
              updatedAt: now,
              lastOpenedAt: now,
            }
          : project,
      ),
    };

    await persistDocument(metadata, scene);
    await set(WORKSPACE_INDEX_KEY, nextIndex, workspaceStore);
    return {
      index: nextIndex,
      document: { ...metadata, scene: normalizeScene(scene) },
    };
  }

  static async createProject(index: WorkspaceIndex, scene: CanvasScene) {
    const now = Date.now();
    const project: WorkspaceProject = {
      id: createId(),
      title: "Untitled Project",
      canvasIds: [],
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    };
    const indexWithProject = {
      ...index,
      projects: [...index.projects, project],
    };
    return this.createCanvas(indexWithProject, scene, project.id);
  }

  static async openCanvas(index: WorkspaceIndex, canvasId: string) {
    const document = await getDocument(canvasId);
    if (!document) {
      return null;
    }

    const now = Date.now();
    const nextIndex: WorkspaceIndex = {
      ...index,
      activeCanvasId: canvasId,
      canvases: index.canvases.map((canvas) =>
        canvas.id === canvasId ? { ...canvas, lastOpenedAt: now } : canvas,
      ),
      projects: index.projects.map((project) =>
        project.id === document.projectId
          ? { ...project, lastOpenedAt: now }
          : project,
      ),
    };
    await set(WORKSPACE_INDEX_KEY, nextIndex, workspaceStore);
    return { index: nextIndex, document };
  }

  private static async deleteCanvases(
    index: WorkspaceIndex,
    canvasIds: Set<string>,
    replacementScene: CanvasScene,
    projectId?: string,
  ) {
    const remainingCanvases = index.canvases.filter(
      (canvas) => !canvasIds.has(canvas.id),
    );
    const activeCanvasDeleted = canvasIds.has(index.activeCanvasId);
    const nextIndex: WorkspaceIndex = {
      ...index,
      activeCanvasId: activeCanvasDeleted
        ? [...remainingCanvases].sort(
            (a, b) => b.lastOpenedAt - a.lastOpenedAt,
          )[0]?.id || index.activeCanvasId
        : index.activeCanvasId,
      canvases: remainingCanvases,
      projects: index.projects
        .filter((project) => project.id !== projectId)
        .map((project) => ({
          ...project,
          canvasIds: project.canvasIds.filter(
            (canvasId) => !canvasIds.has(canvasId),
          ),
        })),
    };

    if (remainingCanvases.length === 0) {
      const replacement = await this.createCanvas(nextIndex, replacementScene);
      await Promise.all(
        [...canvasIds].map((canvasId) =>
          del(canvasKey(canvasId), workspaceStore),
        ),
      );
      return replacement;
    }

    await set(WORKSPACE_INDEX_KEY, nextIndex, workspaceStore);
    await Promise.all(
      [...canvasIds].map((canvasId) =>
        del(canvasKey(canvasId), workspaceStore),
      ),
    );
    return {
      index: nextIndex,
      document: activeCanvasDeleted
        ? await getDocument(nextIndex.activeCanvasId)
        : undefined,
    };
  }

  static async deleteCanvas(
    index: WorkspaceIndex,
    canvasId: string,
    replacementScene: CanvasScene,
  ) {
    if (!index.canvases.some((canvas) => canvas.id === canvasId)) {
      return null;
    }
    return this.deleteCanvases(index, new Set([canvasId]), replacementScene);
  }

  static async deleteProject(
    index: WorkspaceIndex,
    projectId: string,
    replacementScene: CanvasScene,
  ) {
    const project = index.projects.find((project) => project.id === projectId);
    if (!project) {
      return null;
    }
    const projectCanvasIds = new Set([
      ...project.canvasIds,
      ...index.canvases
        .filter((canvas) => canvas.projectId === projectId)
        .map((canvas) => canvas.id),
    ]);
    return this.deleteCanvases(
      index,
      projectCanvasIds,
      replacementScene,
      projectId,
    );
  }

  static async renameProject(
    index: WorkspaceIndex,
    projectId: string,
    title: string,
  ) {
    const normalizedTitle = title.trim() || "Untitled Project";
    const nextIndex = {
      ...index,
      projects: index.projects.map((project) =>
        project.id === projectId
          ? { ...project, title: normalizedTitle, updatedAt: Date.now() }
          : project,
      ),
    };
    await set(WORKSPACE_INDEX_KEY, nextIndex, workspaceStore);
    return nextIndex;
  }
}
