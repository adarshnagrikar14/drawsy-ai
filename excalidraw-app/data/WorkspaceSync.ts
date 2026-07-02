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
  | "deleteProject"
  | "deleteCanvas"
>;

export class WorkspaceSync {
  constructor(private readonly api: WorkspaceSyncApi) {}

  async initialize(userId: string, initialScene: CanvasScene) {
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
    if (remote.canvases.length > 0) {
      const remoteData = await this.loadRemoteDocuments(
        remote,
        workspace.index,
      );
      const reconciled = await WorkspaceStore.reconcileRemote(
        workspace.index,
        remoteData.projects,
        remoteData.documents,
      );
      if (reconciled?.document) {
        workspace = { ...reconciled, isNewWorkspace: false };
      }
    }

    const index = await this.push(workspace.index);
    return { ...workspace, index };
  }

  async push(
    startingIndex: WorkspaceIndex,
    allowConflictRetry = true,
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
        );
      }

      for (const metadata of index.canvases.filter(
        (candidate) => candidate.sync.dirty,
      )) {
        const document = await WorkspaceStore.getDocument(metadata.id);
        if (!document) {
          continue;
        }
        const remote = await this.api.putCanvas(document);
        index = await WorkspaceStore.markCanvasSynced(
          index,
          metadata.id,
          remote.version,
        );
      }
    } catch (error) {
      if (
        allowConflictRetry &&
        error instanceof WorkspaceApiError &&
        error.status === 409
      ) {
        const reconciled = await this.reconcile(index);
        return this.push(reconciled, false);
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
    const documents = await Promise.all(
      remote.canvases.map(async ({ version, ...canvas }) => {
        const local = localIndex?.canvases.find(
          (candidate) => candidate.id === canvas.id,
        );
        const localDocument = local
          ? await WorkspaceStore.getDocument(local.id)
          : null;
        const scene =
          localDocument && local?.sync.remoteVersion === version
            ? localDocument.scene
            : await this.api.getCanvasScene(canvas.id);
        const metadata: RemoteCanvasMetadata = {
          ...canvas,
          remoteVersion: version,
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
