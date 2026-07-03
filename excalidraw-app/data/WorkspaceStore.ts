import { randomId } from "@excalidraw/common";
import { createStore, del, get, set } from "idb-keyval";

import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";

import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

const workspaceStore = createStore("drawsy-workspace-db", "workspace-store");
const LEGACY_WORKSPACE_INDEX_KEY = "workspace-index";
const SCHEMA_VERSION = 3;
const GUEST_SCOPE = "guest";
export const WORKSPACE_SYNC_CHANNEL = "drawsy-workspace-sync";
export const WORKSPACE_CLIENT_ID = randomId();

let activeScope = GUEST_SCOPE;
let workspaceSyncChannel: BroadcastChannel | null = null;

export type WorkspaceSyncState = {
  remoteVersion: number;
  dirty: boolean;
};

export type CanvasSyncState = WorkspaceSyncState & {
  remoteContentHash: string | null;
  contentDirty: boolean;
};

export type CanvasDocumentMetadata = {
  id: string;
  title: string;
  projectId: string | null;
  version: number;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number;
  sync: CanvasSyncState;
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
  version: number;
  sync: WorkspaceSyncState;
};

export type WorkspacePendingDelete = {
  type: "canvas" | "project";
  id: string;
  remoteVersion: number;
};

export type WorkspaceIndex = {
  schemaVersion: typeof SCHEMA_VERSION;
  activeCanvasId: string;
  canvases: CanvasDocumentMetadata[];
  projects: WorkspaceProject[];
  pendingDeletes: WorkspacePendingDelete[];
};

export type RemoteWorkspaceProject = Omit<
  WorkspaceProject,
  "canvasIds" | "version" | "sync"
> & { remoteVersion: number };

export type RemoteCanvasMetadata = Omit<
  CanvasDocumentMetadata,
  "version" | "sync"
> & { remoteVersion: number; remoteContentHash: string | null };

type WorkspaceCanvasResult = {
  index: WorkspaceIndex;
  document: CanvasDocument;
};

const scopeForUser = (userId: string | null) =>
  userId ? `user:${userId}` : GUEST_SCOPE;

const workspaceIndexKey = (scope = activeScope) => `workspace-index:${scope}`;

const canvasKey = (id: string, scope = activeScope) => `canvas:${scope}:${id}`;

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

const sortObjectKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortObjectKeys((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
};

const scenesMatch = (first: CanvasScene, second: CanvasScene) =>
  JSON.stringify(sortObjectKeys(normalizeScene(first))) ===
  JSON.stringify(sortObjectKeys(normalizeScene(second)));

const createCanvasSyncState = (
  sync?: Partial<CanvasSyncState>,
): CanvasSyncState => ({
  remoteVersion: Number(sync?.remoteVersion || 0),
  remoteContentHash:
    typeof sync?.remoteContentHash === "string" ? sync.remoteContentHash : null,
  dirty: sync?.dirty ?? true,
  contentDirty: sync?.contentDirty ?? sync?.dirty ?? true,
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
    sync: createCanvasSyncState(),
  };
};

const persistDocument = async (
  metadata: CanvasDocumentMetadata,
  scene: CanvasScene,
  scope = activeScope,
) => {
  await set(
    canvasKey(metadata.id, scope),
    { ...metadata, scene: normalizeScene(scene) } as CanvasDocument,
    workspaceStore,
  );
};

const getDocument = (id: string) =>
  get<CanvasDocument>(canvasKey(id), workspaceStore);

const getScopedIndex = (scope = activeScope) =>
  get<WorkspaceIndex>(workspaceIndexKey(scope), workspaceStore);

const persistIndex = async (index: WorkspaceIndex, scope = activeScope) => {
  await set(workspaceIndexKey(scope), index, workspaceStore);
  const hasPendingWork =
    index.pendingDeletes.length > 0 ||
    index.projects.some((project) => project.sync.dirty) ||
    index.canvases.some((canvas) => canvas.sync.dirty);
  if (
    hasPendingWork &&
    typeof window !== "undefined" &&
    typeof window.BroadcastChannel !== "undefined"
  ) {
    workspaceSyncChannel ||= new window.BroadcastChannel(
      WORKSPACE_SYNC_CHANNEL,
    );
    workspaceSyncChannel.postMessage({ source: WORKSPACE_CLIENT_ID, scope });
  }
};

const withWorkspaceLock = async <T>(
  operation: () => Promise<T>,
): Promise<T> => {
  const scope = activeScope;
  const lockManager =
    typeof navigator === "undefined" ? undefined : navigator.locks;
  if (!lockManager) {
    return operation();
  }
  return lockManager.request(`drawsy-workspace:${scope}`, async () => {
    if (activeScope !== scope) {
      throw new Error("Workspace scope changed while waiting for storage");
    }
    return operation();
  });
};

const getLatestMutationIndex = async (requested: WorkspaceIndex) => {
  const latest = await getScopedIndex();
  if (!latest || latest.schemaVersion !== SCHEMA_VERSION) {
    return requested;
  }
  return {
    ...latest,
    activeCanvasId: latest.canvases.some(
      (canvas) => canvas.id === requested.activeCanvasId,
    )
      ? requested.activeCanvasId
      : latest.activeCanvasId,
  };
};

const migrateIndex = async (
  index: Omit<WorkspaceIndex, "schemaVersion" | "pendingDeletes"> & {
    schemaVersion: number;
    pendingDeletes?: WorkspacePendingDelete[];
  },
  sourceScope: string,
  targetScope = activeScope,
) => {
  const projects = index.projects.map((project) => ({
    ...project,
    version: "version" in project ? Number(project.version) : 1,
    sync:
      "sync" in project
        ? (project.sync as WorkspaceSyncState)
        : { remoteVersion: 0, dirty: true },
  }));
  const canvases = index.canvases.map((canvas) => ({
    ...canvas,
    sync: createCanvasSyncState(
      "sync" in canvas ? (canvas.sync as Partial<CanvasSyncState>) : undefined,
    ),
  }));
  const migrated: WorkspaceIndex = {
    schemaVersion: SCHEMA_VERSION,
    activeCanvasId: index.activeCanvasId,
    projects,
    canvases,
    pendingDeletes: index.pendingDeletes || [],
  };

  await Promise.all(
    canvases.map(async (metadata) => {
      const legacyKey =
        sourceScope === "legacy"
          ? `canvas:${metadata.id}`
          : canvasKey(metadata.id, sourceScope);
      const document = await get<CanvasDocument>(legacyKey, workspaceStore);
      if (document) {
        await persistDocument(
          { ...metadata, sync: metadata.sync },
          document.scene,
          targetScope,
        );
      }
    }),
  );
  await persistIndex(migrated, targetScope);
  return migrated;
};

export class WorkspaceStore {
  static setScope(userId: string | null) {
    activeScope = scopeForUser(userId);
  }

  static getScope() {
    return activeScope;
  }

  static async hasWorkspace() {
    return !!(await getScopedIndex());
  }

  static getIndex() {
    return getScopedIndex();
  }

  static async initialize(initialScene: CanvasScene) {
    return withWorkspaceLock(() => this.initializeUnlocked(initialScene));
  }

  private static async initializeUnlocked(initialScene: CanvasScene) {
    let existingIndex = await getScopedIndex();

    if (!existingIndex && activeScope === GUEST_SCOPE) {
      const legacyIndex = await get<WorkspaceIndex>(
        LEGACY_WORKSPACE_INDEX_KEY,
        workspaceStore,
      );
      if (legacyIndex) {
        existingIndex = await migrateIndex(legacyIndex, "legacy", GUEST_SCOPE);
      }
    } else if (
      existingIndex &&
      existingIndex.schemaVersion !== SCHEMA_VERSION
    ) {
      existingIndex = await migrateIndex(
        existingIndex,
        activeScope,
        activeScope,
      );
    }

    if (existingIndex?.schemaVersion === SCHEMA_VERSION) {
      const cachedDocuments = await Promise.all(
        existingIndex.canvases.map((canvas) => getDocument(canvas.id)),
      );
      let repairedFromDocuments = false;
      const repairedCanvases = existingIndex.canvases.map((canvas, index) => {
        const document = cachedDocuments[index];
        if (document && document.version >= canvas.version) {
          const { scene: _scene, ...documentMetadata } = document;
          if (JSON.stringify(documentMetadata) !== JSON.stringify(canvas)) {
            repairedFromDocuments = true;
            return documentMetadata;
          }
        }
        return canvas;
      });
      if (repairedFromDocuments) {
        existingIndex = { ...existingIndex, canvases: repairedCanvases };
        await persistIndex(existingIndex);
      }

      const activeCanvasId = existingIndex.activeCanvasId;
      const activeDocument = await getDocument(activeCanvasId);
      const hasActiveMetadata = existingIndex.canvases.some(
        (canvas) => canvas.id === activeCanvasId,
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
          await persistIndex(repairedIndex);
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
      pendingDeletes: [],
    };

    await persistDocument(metadata, initialScene);
    await persistIndex(index);

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
    return withWorkspaceLock(async () => {
      const expected = index.canvases.find((canvas) => canvas.id === canvasId);
      const currentIndex = await getLatestMutationIndex(index);
      const metadata = currentIndex.canvases.find(
        (canvas) => canvas.id === canvasId,
      );
      if (!metadata) {
        return currentIndex;
      }

      if (expected && metadata.version > expected.version) {
        const currentDocument = await getDocument(canvasId);
        if (currentDocument && !scenesMatch(currentDocument.scene, scene)) {
          const title = getUniqueCanvasTitle(
            currentIndex,
            `${getSceneTitle(scene)} (conflict)`,
          );
          const conflictMetadata: CanvasDocumentMetadata = {
            ...metadata,
            id: createId(),
            title,
            version: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastOpenedAt: Date.now(),
            sync: createCanvasSyncState(),
          };
          const conflictScene = {
            ...scene,
            appState: { ...scene.appState, name: title },
          };
          const conflictIndex: WorkspaceIndex = {
            ...currentIndex,
            activeCanvasId:
              index.activeCanvasId === canvasId
                ? conflictMetadata.id
                : currentIndex.activeCanvasId,
            canvases: [...currentIndex.canvases, conflictMetadata],
            projects: currentIndex.projects.map((project) =>
              project.id === conflictMetadata.projectId
                ? {
                    ...project,
                    canvasIds: [...project.canvasIds, conflictMetadata.id],
                    version: project.version + 1,
                    updatedAt: Date.now(),
                    sync: { ...project.sync, dirty: true },
                  }
                : project,
            ),
          };
          await persistDocument(conflictMetadata, conflictScene);
          await persistIndex(conflictIndex);
          return conflictIndex;
        }
      }

      const nextMetadata: CanvasDocumentMetadata = {
        ...metadata,
        title: getSceneTitle(scene),
        version: metadata.version + 1,
        updatedAt: Date.now(),
        sync: { ...metadata.sync, dirty: true, contentDirty: true },
      };
      const nextIndex = {
        ...currentIndex,
        canvases: currentIndex.canvases.map((canvas) =>
          canvas.id === canvasId ? nextMetadata : canvas,
        ),
      };

      await persistDocument(nextMetadata, scene);
      await persistIndex(nextIndex);
      return nextIndex;
    });
  }

  static createCanvas(
    index: WorkspaceIndex,
    scene: CanvasScene,
  ): Promise<WorkspaceCanvasResult>;
  static createCanvas(
    index: WorkspaceIndex,
    scene: CanvasScene,
    projectId: string,
  ): Promise<WorkspaceCanvasResult | null>;
  static async createCanvas(
    index: WorkspaceIndex,
    scene: CanvasScene,
    projectId: string | null = null,
  ): Promise<WorkspaceCanvasResult | null> {
    return withWorkspaceLock(async () => {
      const currentIndex = await getLatestMutationIndex(index);
      if (
        projectId &&
        !currentIndex.projects.some((project) => project.id === projectId)
      ) {
        return null;
      }
      return this.createCanvasUnlocked(currentIndex, scene, projectId);
    });
  }

  private static async createCanvasUnlocked(
    index: WorkspaceIndex,
    scene: CanvasScene,
    projectId: string | null,
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
              version: project.version + 1,
              sync: { ...project.sync, dirty: true },
            }
          : project,
      ),
    };
    await persistDocument(metadata, scene);
    await persistIndex(nextIndex);
    return {
      index: nextIndex,
      document: { ...metadata, scene: normalizeScene(scene) },
    };
  }

  static async createProject(index: WorkspaceIndex, scene: CanvasScene) {
    return withWorkspaceLock(async () => {
      const currentIndex = await getLatestMutationIndex(index);
      const now = Date.now();
      const project: WorkspaceProject = {
        id: createId(),
        title: "Untitled Project",
        canvasIds: [],
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
        version: 1,
        sync: { remoteVersion: 0, dirty: true },
      };
      return this.createCanvasUnlocked(
        { ...currentIndex, projects: [...currentIndex.projects, project] },
        scene,
        project.id,
      );
    });
  }

  static async openCanvas(index: WorkspaceIndex, canvasId: string) {
    return withWorkspaceLock(async () => {
      const currentIndex = await getLatestMutationIndex(index);
      const document = await getDocument(canvasId);
      if (!document) {
        return null;
      }
      const now = Date.now();
      const nextIndex: WorkspaceIndex = {
        ...currentIndex,
        activeCanvasId: canvasId,
        canvases: currentIndex.canvases.map((canvas) =>
          canvas.id === canvasId
            ? { ...canvas, lastOpenedAt: now, version: canvas.version + 1 }
            : canvas,
        ),
        projects: currentIndex.projects.map((project) =>
          project.id === document.projectId
            ? { ...project, lastOpenedAt: now }
            : project,
        ),
      };
      const openedCanvas = nextIndex.canvases.find(
        (canvas) => canvas.id === canvasId,
      );
      if (openedCanvas) {
        const sync = {
          ...openedCanvas.sync,
          dirty: true,
        };
        const dirtyOpenedCanvas = { ...openedCanvas, sync };
        nextIndex.canvases = nextIndex.canvases.map((canvas) =>
          canvas.id === canvasId ? dirtyOpenedCanvas : canvas,
        );
        await persistDocument(dirtyOpenedCanvas, document.scene);
      }
      await persistIndex(nextIndex);
      return {
        index: nextIndex,
        document: openedCanvas
          ? {
              ...openedCanvas,
              sync: { ...openedCanvas.sync, dirty: true },
              scene: document.scene,
            }
          : document,
      };
    });
  }

  static async cacheRemoteCanvas(
    index: WorkspaceIndex,
    canvasId: string,
    scene: CanvasScene,
  ) {
    return withWorkspaceLock(async () => {
      const currentIndex = await getLatestMutationIndex(index);
      const metadata = currentIndex.canvases.find(
        (canvas) => canvas.id === canvasId,
      );
      if (!metadata) {
        return currentIndex;
      }
      await persistDocument(metadata, scene);
      return currentIndex;
    });
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
    const deletedProject = projectId
      ? index.projects.find((project) => project.id === projectId)
      : null;
    const pendingDeletes = [...index.pendingDeletes];
    if (deletedProject?.sync.remoteVersion) {
      pendingDeletes.push({
        type: "project",
        id: deletedProject.id,
        remoteVersion: deletedProject.sync.remoteVersion,
      });
    } else if (!projectId) {
      for (const canvas of index.canvases) {
        if (canvasIds.has(canvas.id) && canvas.sync.remoteVersion) {
          pendingDeletes.push({
            type: "canvas",
            id: canvas.id,
            remoteVersion: canvas.sync.remoteVersion,
          });
        }
      }
    }
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
      pendingDeletes,
    };

    if (remainingCanvases.length === 0) {
      const replacement = await this.createCanvasUnlocked(
        nextIndex,
        replacementScene,
        null,
      );
      await Promise.all(
        [...canvasIds].map((canvasId) =>
          del(canvasKey(canvasId), workspaceStore),
        ),
      );
      return replacement;
    }

    await persistIndex(nextIndex);
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
    return withWorkspaceLock(async () => {
      const currentIndex = await getLatestMutationIndex(index);
      if (!currentIndex.canvases.some((canvas) => canvas.id === canvasId)) {
        return null;
      }
      return this.deleteCanvases(
        currentIndex,
        new Set([canvasId]),
        replacementScene,
      );
    });
  }

  static async deleteProject(
    index: WorkspaceIndex,
    projectId: string,
    replacementScene: CanvasScene,
  ) {
    return withWorkspaceLock(async () => {
      const currentIndex = await getLatestMutationIndex(index);
      const project = currentIndex.projects.find(
        (project) => project.id === projectId,
      );
      if (!project) {
        return null;
      }
      const projectCanvasIds = new Set([
        ...project.canvasIds,
        ...currentIndex.canvases
          .filter((canvas) => canvas.projectId === projectId)
          .map((canvas) => canvas.id),
      ]);
      return this.deleteCanvases(
        currentIndex,
        projectCanvasIds,
        replacementScene,
        projectId,
      );
    });
  }

  static async renameProject(
    index: WorkspaceIndex,
    projectId: string,
    title: string,
  ) {
    return withWorkspaceLock(async () => {
      const currentIndex = await getLatestMutationIndex(index);
      const normalizedTitle = title.trim() || "Untitled Project";
      const nextIndex = {
        ...currentIndex,
        projects: currentIndex.projects.map((project) =>
          project.id === projectId
            ? { ...project, title: normalizedTitle, updatedAt: Date.now() }
            : project,
        ),
      };
      const project = nextIndex.projects.find(
        (candidate) => candidate.id === projectId,
      );
      if (project) {
        nextIndex.projects = nextIndex.projects.map((candidate) =>
          candidate.id === projectId
            ? {
                ...candidate,
                version: candidate.version + 1,
                sync: { ...candidate.sync, dirty: true },
              }
            : candidate,
        );
      }
      await persistIndex(nextIndex);
      return nextIndex;
    });
  }

  static async getDocuments(index: WorkspaceIndex) {
    const documents = await Promise.all(
      index.canvases.map((canvas) => getDocument(canvas.id)),
    );
    return documents.filter(
      (document): document is CanvasDocument => !!document,
    );
  }

  static getDocument(canvasId: string) {
    return getDocument(canvasId);
  }

  static async seedFromGuest() {
    if (activeScope === GUEST_SCOPE || (await getScopedIndex())) {
      return null;
    }
    let guestIndex = await getScopedIndex(GUEST_SCOPE);
    if (!guestIndex) {
      const legacyIndex = await get<WorkspaceIndex>(
        LEGACY_WORKSPACE_INDEX_KEY,
        workspaceStore,
      );
      if (legacyIndex) {
        guestIndex = await migrateIndex(legacyIndex, "legacy", GUEST_SCOPE);
      }
    }
    if (!guestIndex) {
      return null;
    }
    const projects = guestIndex.projects.map((project) => ({
      ...project,
      version: 1,
      sync: { remoteVersion: 0, dirty: true },
    }));
    const canvases = guestIndex.canvases.map((canvas) => ({
      ...canvas,
      version: 1,
      sync: createCanvasSyncState(),
    }));
    const index: WorkspaceIndex = {
      schemaVersion: SCHEMA_VERSION,
      activeCanvasId: guestIndex.activeCanvasId,
      projects,
      canvases,
      pendingDeletes: [],
    };
    await Promise.all(
      canvases.map(async (metadata) => {
        const document = await get<CanvasDocument>(
          canvasKey(metadata.id, GUEST_SCOPE),
          workspaceStore,
        );
        if (document) {
          await persistDocument(metadata, document.scene);
        }
      }),
    );
    await persistIndex(index);
    return index;
  }

  static async replaceWithRemote(
    projects: RemoteWorkspaceProject[],
    documents: Array<{
      metadata: RemoteCanvasMetadata;
      scene: CanvasScene | null;
    }>,
  ) {
    const previous = await getScopedIndex();
    if (previous) {
      await Promise.all(
        previous.canvases.map((canvas) =>
          del(canvasKey(canvas.id), workspaceStore),
        ),
      );
    }
    const canvases: CanvasDocumentMetadata[] = documents.map(
      ({ metadata: { remoteVersion, remoteContentHash, ...metadata } }) => ({
        ...metadata,
        version: 1,
        sync: {
          remoteVersion,
          remoteContentHash,
          dirty: false,
          contentDirty: false,
        },
      }),
    );
    const localProjects: WorkspaceProject[] = projects.map(
      ({ remoteVersion, ...project }) => ({
        ...project,
        version: 1,
        canvasIds: canvases
          .filter((canvas) => canvas.projectId === project.id)
          .map((canvas) => canvas.id),
        sync: { remoteVersion, dirty: false },
      }),
    );
    const activeCanvas = [...canvases].sort(
      (first, second) => second.lastOpenedAt - first.lastOpenedAt,
    )[0];
    if (!activeCanvas) {
      return null;
    }
    const index: WorkspaceIndex = {
      schemaVersion: SCHEMA_VERSION,
      activeCanvasId: activeCanvas.id,
      canvases,
      projects: localProjects,
      pendingDeletes: [],
    };
    await Promise.all(
      documents.map(({ metadata, scene }) => {
        const localMetadata = canvases.find(
          (canvas) => canvas.id === metadata.id,
        );
        return localMetadata && scene
          ? persistDocument(localMetadata, scene)
          : Promise.resolve();
      }),
    );
    await persistIndex(index);
    const document = await getDocument(activeCanvas.id);
    if (!document) {
      return null;
    }
    return {
      index,
      document,
    };
  }

  static async markProjectSynced(
    index: WorkspaceIndex,
    projectId: string,
    remoteVersion: number,
    expectedLocalVersion: number,
  ) {
    return withWorkspaceLock(async () => {
      const currentIndex = (await getScopedIndex()) || index;
      const nextIndex: WorkspaceIndex = {
        ...currentIndex,
        projects: currentIndex.projects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                sync: {
                  remoteVersion,
                  dirty: project.version !== expectedLocalVersion,
                },
              }
            : project,
        ),
      };
      await persistIndex(nextIndex);
      return nextIndex;
    });
  }

  static async markCanvasSynced(
    index: WorkspaceIndex,
    canvasId: string,
    remoteVersion: number,
    remoteContentHash: string | null,
    expectedLocalVersion: number,
  ) {
    return withWorkspaceLock(async () => {
      const currentIndex = (await getScopedIndex()) || index;
      const metadata = currentIndex.canvases.find(
        (canvas) => canvas.id === canvasId,
      );
      const document = await getDocument(canvasId);
      if (!metadata || !document) {
        return currentIndex;
      }
      const changedWhileSyncing = metadata.version !== expectedLocalVersion;
      const syncedMetadata = {
        ...metadata,
        sync: {
          remoteVersion,
          remoteContentHash,
          dirty: changedWhileSyncing,
          contentDirty: changedWhileSyncing
            ? metadata.sync.contentDirty
            : false,
        },
      };
      const nextIndex: WorkspaceIndex = {
        ...currentIndex,
        canvases: currentIndex.canvases.map((canvas) =>
          canvas.id === canvasId ? syncedMetadata : canvas,
        ),
      };
      await persistDocument(syncedMetadata, document.scene);
      await persistIndex(nextIndex);
      return nextIndex;
    });
  }

  static async acknowledgeDelete(
    index: WorkspaceIndex,
    type: WorkspacePendingDelete["type"],
    id: string,
  ) {
    return withWorkspaceLock(async () => {
      const currentIndex = (await getScopedIndex()) || index;
      const nextIndex = {
        ...currentIndex,
        pendingDeletes: currentIndex.pendingDeletes.filter(
          (pending) => pending.type !== type || pending.id !== id,
        ),
      };
      await persistIndex(nextIndex);
      return nextIndex;
    });
  }

  static async reconcileRemote(
    index: WorkspaceIndex,
    projects: RemoteWorkspaceProject[],
    documents: Array<{
      metadata: RemoteCanvasMetadata;
      scene: CanvasScene | null;
    }>,
    replacementScene: CanvasScene,
  ) {
    return withWorkspaceLock(async () =>
      this.reconcileRemoteUnlocked(
        await getLatestMutationIndex(index),
        projects,
        documents,
        replacementScene,
      ),
    );
  }

  private static async reconcileRemoteUnlocked(
    index: WorkspaceIndex,
    projects: RemoteWorkspaceProject[],
    documents: Array<{
      metadata: RemoteCanvasMetadata;
      scene: CanvasScene | null;
    }>,
    replacementScene: CanvasScene,
  ) {
    const pendingDeleteIds = new Set(
      index.pendingDeletes.map((pending) => pending.id),
    );
    const remoteProjectIds = new Set(projects.map((project) => project.id));
    const remoteCanvasIds = new Set(
      documents.map(({ metadata }) => metadata.id),
    );
    const nextProjects: WorkspaceProject[] = [];

    for (const remote of projects) {
      if (pendingDeleteIds.has(remote.id)) {
        continue;
      }
      const local = index.projects.find((project) => project.id === remote.id);
      if (local?.sync.dirty) {
        nextProjects.push({
          ...local,
          sync: {
            ...local.sync,
            remoteVersion:
              local.sync.remoteVersion === remote.remoteVersion
                ? local.sync.remoteVersion
                : remote.remoteVersion,
          },
        });
      } else {
        const { remoteVersion, ...metadata } = remote;
        nextProjects.push({
          ...metadata,
          version: local?.version || 1,
          canvasIds: [],
          sync: { remoteVersion, dirty: false },
        });
      }
    }
    nextProjects.push(
      ...index.projects.filter(
        (project) =>
          !remoteProjectIds.has(project.id) &&
          project.sync.remoteVersion === 0 &&
          !pendingDeleteIds.has(project.id),
      ),
    );

    const nextCanvases: CanvasDocumentMetadata[] = [];
    let activeConflictCanvasId: string | null = null;
    for (const { metadata: remote, scene } of documents) {
      if (pendingDeleteIds.has(remote.id)) {
        continue;
      }
      const local = index.canvases.find((canvas) => canvas.id === remote.id);
      if (
        local?.sync.dirty &&
        (local.sync.remoteVersion === remote.remoteVersion ||
          (remote.remoteContentHash !== null &&
            local.sync.remoteContentHash === remote.remoteContentHash))
      ) {
        nextCanvases.push({
          ...local,
          sync: {
            ...local.sync,
            remoteVersion: remote.remoteVersion,
            remoteContentHash: remote.remoteContentHash,
          },
        });
        continue;
      }
      if (
        local?.sync.contentDirty &&
        local.sync.remoteVersion !== remote.remoteVersion
      ) {
        const localDocument = await getDocument(local.id);
        if (
          localDocument &&
          scene &&
          !scenesMatch(localDocument.scene, scene)
        ) {
          const conflictTitle = getUniqueCanvasTitle(
            { ...index, canvases: [...index.canvases, ...nextCanvases] },
            `${local.title} (conflict)`,
          );
          const conflictMetadata: CanvasDocumentMetadata = {
            ...local,
            id: createId(),
            title: conflictTitle,
            version: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            sync: createCanvasSyncState(),
          };
          nextCanvases.push(conflictMetadata);
          await persistDocument(conflictMetadata, {
            ...localDocument.scene,
            appState: {
              ...localDocument.scene.appState,
              name: conflictTitle,
            },
          });
          if (local.id === index.activeCanvasId) {
            activeConflictCanvasId = conflictMetadata.id;
          }
        }
      }

      const { remoteVersion, remoteContentHash, ...metadata } = remote;
      const localMetadata: CanvasDocumentMetadata = {
        ...metadata,
        lastOpenedAt:
          local?.sync.dirty && !local.sync.contentDirty
            ? Math.max(local.lastOpenedAt, metadata.lastOpenedAt)
            : metadata.lastOpenedAt,
        version: local?.version || 1,
        sync: {
          remoteVersion,
          remoteContentHash,
          dirty: !!local?.sync.dirty && !local.sync.contentDirty,
          contentDirty: false,
        },
      };
      nextCanvases.push(localMetadata);
      if (scene) {
        await persistDocument(localMetadata, scene);
      }
    }

    const localOnlyCanvases = index.canvases.filter(
      (canvas) =>
        !remoteCanvasIds.has(canvas.id) &&
        canvas.sync.remoteVersion === 0 &&
        !pendingDeleteIds.has(canvas.id),
    );
    nextCanvases.push(...localOnlyCanvases);

    if (nextCanvases.length === 0) {
      const replacement = createMetadata(replacementScene, null);
      nextCanvases.push(replacement);
      await persistDocument(replacement, replacementScene);
    }

    await Promise.all(
      index.canvases
        .filter(
          (canvas) =>
            !nextCanvases.some((candidate) => candidate.id === canvas.id),
        )
        .map((canvas) => del(canvasKey(canvas.id), workspaceStore)),
    );

    const projectsWithCanvases = nextProjects.map((project) => ({
      ...project,
      canvasIds: nextCanvases
        .filter((canvas) => canvas.projectId === project.id)
        .map((canvas) => canvas.id),
    }));
    const activeCanvasId =
      activeConflictCanvasId ||
      (nextCanvases.some((canvas) => canvas.id === index.activeCanvasId)
        ? index.activeCanvasId
        : [...nextCanvases].sort(
            (first, second) => second.lastOpenedAt - first.lastOpenedAt,
          )[0]?.id);
    if (!activeCanvasId) {
      return null;
    }
    const nextIndex: WorkspaceIndex = {
      ...index,
      activeCanvasId,
      projects: projectsWithCanvases,
      canvases: nextCanvases,
    };
    await persistIndex(nextIndex);
    const document = await getDocument(activeCanvasId);
    if (!document) {
      return null;
    }
    return {
      index: nextIndex,
      document,
    };
  }
}
