import {
  WorkspaceStore,
  type CanvasScene,
  type RemoteCanvasMetadata,
  type RemoteWorkspaceProject,
  type WorkspaceIndex,
} from "./WorkspaceStore";

import { WorkspaceApiError } from "./WorkspaceApi";

import type { WorkspaceApi } from "./WorkspaceApi";

type WorkspaceSyncApi = Pick<
  WorkspaceApi,
  | "getWorkspace"
  | "getCanvasScene"
  | "putProject"
  | "putCanvas"
  | "patchCanvas"
  | "deleteProject"
  | "deleteCanvas"
>;

export class WorkspaceSync {
  private userId: string | null = null;
  private replacementScene: CanvasScene = {
    elements: [],
    appState: { name: "Untitled" },
    files: {},
  };

  constructor(private readonly api: WorkspaceSyncApi) {}

  async initialize(userId: string, initialScene: CanvasScene) {
    this.userId = userId;
    this.replacementScene = {
      elements: [],
      appState: { ...initialScene.appState, name: "Untitled" },
      files: {},
    };
    WorkspaceStore.setScope(userId);
    const remote = await this.api.getWorkspace();
    const hasLocalWorkspace = await WorkspaceStore.hasWorkspace();

    if (!hasLocalWorkspace && remote.canvases.length > 0) {
      const remoteData = await this.loadRemoteDocuments(remote);
      const replaced = await WorkspaceStore.replaceWithRemote(
        remoteData.projects,
        remoteData.documents,
      );
      if (replaced?.document) {
        return { ...replaced, isNewWorkspace: false };
      }
    }

    if (!hasLocalWorkspace && remote.canvases.length === 0) {
      await WorkspaceStore.seedFromGuest();
    }

    let workspace = await WorkspaceStore.initialize(initialScene);
    const remoteData = await this.loadRemoteDocuments(remote, workspace.index);
    const reconciled = await WorkspaceStore.reconcileRemote(
      workspace.index,
      remoteData.projects,
      remoteData.documents,
      this.replacementScene,
    );
    if (reconciled?.document) {
      workspace = { ...reconciled, isNewWorkspace: false };
    }

    return workspace;
  }

  async push(
    startingIndex: WorkspaceIndex,
    allowConflictRetry = true,
  ): Promise<WorkspaceIndex> {
    const run = async () => {
      const persisted = await WorkspaceStore.getIndex();
      const latest = persisted || startingIndex;
      return this.pushUnlocked(latest, allowConflictRetry);
    };
    const lockManager =
      typeof navigator === "undefined" ? undefined : navigator.locks;
    return lockManager && this.userId
      ? lockManager.request(`drawsy-cloud-sync:${this.userId}`, run)
      : run();
  }

  async synchronize(startingIndex: WorkspaceIndex) {
    const reconciled = await this.reconcile(startingIndex);
    const index = await this.push(reconciled);
    return {
      index,
      document: await WorkspaceStore.getDocument(index.activeCanvasId),
    };
  }

  async openCanvas(index: WorkspaceIndex, canvasId: string) {
    const metadata = index.canvases.find((canvas) => canvas.id === canvasId);
    if (!metadata) {
      return null;
    }
    const cached = await WorkspaceStore.getDocument(canvasId);
    if (
      !cached ||
      cached.sync.remoteContentHash !== metadata.sync.remoteContentHash
    ) {
      try {
        const scene = await this.api.getCanvasScene(canvasId);
        index = await WorkspaceStore.cacheRemoteCanvas(index, canvasId, scene);
      } catch (error) {
        if (error instanceof WorkspaceApiError && error.status === 404) {
          const reconciled = await this.reconcile(index);
          const document = await WorkspaceStore.getDocument(
            reconciled.activeCanvasId,
          );
          return document ? { index: reconciled, document } : null;
        }
        const canUseCachedScene =
          cached &&
          (!(error instanceof WorkspaceApiError) ||
            error.status === 408 ||
            error.status === 429 ||
            error.status >= 500);
        if (canUseCachedScene) {
          return WorkspaceStore.openCachedCanvas(index, canvasId);
        }
        throw error;
      }
    }
    return WorkspaceStore.openCanvas(index, canvasId);
  }

  private async pushUnlocked(
    startingIndex: WorkspaceIndex,
    allowConflictRetry: boolean,
  ): Promise<WorkspaceIndex> {
    let index = startingIndex;

    for (const pending of [...index.pendingDeletes]) {
      try {
        if (pending.type === "project") {
          await this.api.deleteProject(pending.id, pending.remoteVersion);
        } else {
          await this.api.deleteCanvas(pending.id, pending.remoteVersion);
        }
      } catch (error) {
        if (!(error instanceof WorkspaceApiError)) {
          throw error;
        }
        if (error.status === 409) {
          const remote = await this.api.getWorkspace();
          const current =
            pending.type === "project"
              ? remote.projects.find((project) => project.id === pending.id)
              : remote.canvases.find((canvas) => canvas.id === pending.id);
          if (current) {
            if (pending.type === "project") {
              await this.api.deleteProject(pending.id, current.version);
            } else {
              await this.api.deleteCanvas(pending.id, current.version);
            }
          }
        } else if (error.status !== 404) {
          throw error;
        }
      }
      index = await WorkspaceStore.acknowledgeDelete(
        index,
        pending.type,
        pending.id,
      );
    }

    try {
      for (const project of index.projects.filter(
        (candidate) => candidate.sync.dirty,
      )) {
        const remote = await this.api.putProject(project);
        index = await WorkspaceStore.markProjectSynced(
          index,
          project.id,
          remote.version,
          project.version,
        );
      }

      for (const metadata of index.canvases.filter(
        (candidate) => candidate.sync.dirty,
      )) {
        const document = await WorkspaceStore.getDocument(metadata.id);
        if (!document) {
          continue;
        }
        const remote = metadata.sync.contentDirty
          ? await this.api.putCanvas(document)
          : await this.api.patchCanvas(document);
        index = await WorkspaceStore.markCanvasSynced(
          index,
          metadata.id,
          remote.version,
          remote.contentHash,
          metadata.version,
        );
      }
    } catch (error) {
      if (
        allowConflictRetry &&
        error instanceof WorkspaceApiError &&
        error.status === 409
      ) {
        const reconciled = await this.reconcile(index);
        return this.pushUnlocked(reconciled, false);
      }
      throw error;
    }

    return index;
  }

  private async reconcile(index: WorkspaceIndex) {
    const remote = await this.api.getWorkspace();
    const remoteData = await this.loadRemoteDocuments(remote, index);
    const reconciled = await WorkspaceStore.reconcileRemote(
      index,
      remoteData.projects,
      remoteData.documents,
      this.replacementScene,
    );
    return reconciled?.index || index;
  }

  private async loadRemoteDocuments(
    remote: Awaited<ReturnType<WorkspaceApi["getWorkspace"]>>,
    localIndex?: WorkspaceIndex,
  ) {
    const projects: RemoteWorkspaceProject[] = remote.projects.map(
      ({ version, ...project }) => ({ ...project, remoteVersion: version }),
    );
    const activeCanvasId = remote.canvases.some(
      (canvas) => canvas.id === localIndex?.activeCanvasId,
    )
      ? localIndex?.activeCanvasId
      : [...remote.canvases].sort(
          (first, second) => second.lastOpenedAt - first.lastOpenedAt,
        )[0]?.id;
    const documents = await Promise.all(
      remote.canvases.map(async ({ version, contentHash, ...canvas }) => {
        const local = localIndex?.canvases.find(
          (candidate) => candidate.id === canvas.id,
        );
        const localDocument = local
          ? await WorkspaceStore.getDocument(local.id)
          : null;
        const contentMatches =
          local?.sync.remoteVersion === version ||
          (contentHash !== null &&
            local?.sync.remoteContentHash === contentHash);
        const scene =
          localDocument && contentMatches
            ? localDocument.scene
            : canvas.id === activeCanvasId || local?.sync.dirty
            ? await this.api.getCanvasScene(canvas.id)
            : null;
        const metadata: RemoteCanvasMetadata = {
          ...canvas,
          remoteVersion: version,
          remoteContentHash: contentHash,
        };
        return {
          metadata,
          scene,
        };
      }),
    );
    return { projects, documents };
  }
}
