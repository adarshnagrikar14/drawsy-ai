import { randomId } from "@excalidraw/common";
import { createStore, del, get, set } from "idb-keyval";

import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";

import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

const workspaceStore = createStore("drawsy-workspace-db", "workspace-store");
const LEGACY_WORKSPACE_INDEX_KEY = "workspace-index";
const SCHEMA_VERSION = 2;
const GUEST_SCOPE = "guest";

let activeScope = GUEST_SCOPE;

export type WorkspaceSyncState = {
  remoteVersion: number;
  dirty: boolean;
};

export type CanvasDocumentMetadata = {
  id: string;
  title: string;
  projectId: string | null;
  version: number;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number;
  sync: WorkspaceSyncState;
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
> & { remoteVersion: number };

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
    sync: { remoteVersion: 0, dirty: true },
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

const persistIndex = (index: WorkspaceIndex, scope = activeScope) =>
  set(workspaceIndexKey(scope), index, workspaceStore);

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
    sync:
      "sync" in canvas
        ? (canvas.sync as WorkspaceSyncState)
        : { remoteVersion: 0, dirty: true },
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

  static async initialize(initialScene: CanvasScene) {
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
    const metadata = index.canvases.find((canvas) => canvas.id === canvasId);
    if (!metadata) {
      return index;
    }

    const nextMetadata: CanvasDocumentMetadata = {
      ...metadata,
      title: getSceneTitle(scene),
      version: metadata.version + 1,
      updatedAt: Date.now(),
      sync: { ...metadata.sync, dirty: true },
    };
    const nextIndex = {
      ...index,
      canvases: index.canvases.map((canvas) =>
        canvas.id === canvasId ? nextMetadata : canvas,
      ),
    };

    await persistDocument(nextMetadata, scene);
    await persistIndex(nextIndex);
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
    const openedCanvas = nextIndex.canvases.find(
      (canvas) => canvas.id === canvasId,
    );
    if (openedCanvas) {
      const openedDocument = await getDocument(canvasId);
      if (openedDocument) {
        await persistDocument(
          { ...openedCanvas, sync: { ...openedCanvas.sync, dirty: true } },
          openedDocument.scene,
        );
        nextIndex.canvases = nextIndex.canvases.map((canvas) =>
          canvas.id === canvasId
            ? { ...canvas, sync: { ...canvas.sync, dirty: true } }
            : canvas,
        );
      }
    }
    await persistIndex(nextIndex);
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
      const replacement = await this.createCanvas(nextIndex, replacementScene);
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
      sync: { remoteVersion: 0, dirty: true },
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
      scene: CanvasScene;
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
      ({ metadata: { remoteVersion, ...metadata } }) => ({
        ...metadata,
        version: 1,
        sync: { remoteVersion, dirty: false },
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
        return localMetadata
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
  ) {
    const nextIndex: WorkspaceIndex = {
      ...index,
      projects: index.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              sync: { remoteVersion, dirty: false },
            }
          : project,
      ),
    };
    await persistIndex(nextIndex);
    return nextIndex;
  }

  static async markCanvasSynced(
    index: WorkspaceIndex,
    canvasId: string,
    remoteVersion: number,
  ) {
    const metadata = index.canvases.find((canvas) => canvas.id === canvasId);
    const document = await getDocument(canvasId);
    if (!metadata || !document) {
      return index;
    }
    const syncedMetadata = {
      ...metadata,
      sync: { remoteVersion, dirty: false },
    };
    const nextIndex: WorkspaceIndex = {
      ...index,
      canvases: index.canvases.map((canvas) =>
        canvas.id === canvasId ? syncedMetadata : canvas,
      ),
    };
    await persistDocument(syncedMetadata, document.scene);
    await persistIndex(nextIndex);
    return nextIndex;
  }

  static async acknowledgeDelete(
    index: WorkspaceIndex,
    type: WorkspacePendingDelete["type"],
    id: string,
  ) {
    const nextIndex = {
      ...index,
      pendingDeletes: index.pendingDeletes.filter(
        (pending) => pending.type !== type || pending.id !== id,
      ),
    };
    await persistIndex(nextIndex);
    return nextIndex;
  }

  static async reconcileRemote(
    index: WorkspaceIndex,
    projects: RemoteWorkspaceProject[],
    documents: Array<{
      metadata: RemoteCanvasMetadata;
      scene: CanvasScene;
    }>,
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
    for (const { metadata: remote, scene } of documents) {
      if (pendingDeleteIds.has(remote.id)) {
        continue;
      }
      const local = index.canvases.find((canvas) => canvas.id === remote.id);
      if (
        local?.sync.dirty &&
        local.sync.remoteVersion === remote.remoteVersion
      ) {
        nextCanvases.push(local);
        continue;
      }
      if (
        local?.sync.dirty &&
        local.sync.remoteVersion !== remote.remoteVersion
      ) {
        const localDocument = await getDocument(local.id);
        if (localDocument) {
          const conflictMetadata: CanvasDocumentMetadata = {
            ...local,
            id: createId(),
            title: `${local.title} (conflict)`,
            version: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            sync: { remoteVersion: 0, dirty: true },
          };
          nextCanvases.push(conflictMetadata);
          await persistDocument(conflictMetadata, localDocument.scene);
        }
      }

      const { remoteVersion, ...metadata } = remote;
      const localMetadata: CanvasDocumentMetadata = {
        ...metadata,
        version: local?.version || 1,
        sync: { remoteVersion, dirty: false },
      };
      nextCanvases.push(localMetadata);
      await persistDocument(localMetadata, scene);
    }

    const localOnlyCanvases = index.canvases.filter(
      (canvas) =>
        !remoteCanvasIds.has(canvas.id) &&
        canvas.sync.remoteVersion === 0 &&
        !pendingDeleteIds.has(canvas.id),
    );
    nextCanvases.push(...localOnlyCanvases);

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
    const activeCanvasId = nextCanvases.some(
      (canvas) => canvas.id === index.activeCanvasId,
    )
      ? index.activeCanvasId
      : [...nextCanvases].sort(
          (first, second) => second.lastOpenedAt - first.lastOpenedAt,
        )[0]?.id;
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
