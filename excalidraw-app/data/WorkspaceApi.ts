import type {
  CanvasDocument,
  CanvasDocumentMetadata,
  WorkspaceProject,
} from "./WorkspaceStore";

type RemoteProject = Omit<WorkspaceProject, "canvasIds" | "sync">;

type RemoteCanvas = Omit<CanvasDocumentMetadata, "sync">;

export type RemoteWorkspace = {
  projects: RemoteProject[];
  canvases: RemoteCanvas[];
};

type TokenProvider = () => Promise<string>;

export class WorkspaceApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "WorkspaceApiError";
  }
}

export class WorkspaceApi {
  private readonly baseUrl: string;

  constructor(private readonly getIdToken: TokenProvider) {
    const configuredUrl = import.meta.env.VITE_APP_DRAWSY_BACKEND_URL?.trim();
    if (!configuredUrl) {
      throw new Error("VITE_APP_DRAWSY_BACKEND_URL is not configured");
    }
    this.baseUrl = configuredUrl.replace(/\/$/, "");
  }

  getWorkspace() {
    return this.request<RemoteWorkspace>("/v1/workspace");
  }

  async getCanvasScene(canvasId: string) {
    const result = await this.request<{ scene: CanvasDocument["scene"] }>(
      `/v1/canvases/${encodeURIComponent(canvasId)}/scene`,
    );
    return result.scene;
  }

  async putProject(project: WorkspaceProject) {
    const result = await this.request<{ project: RemoteProject }>(
      `/v1/projects/${encodeURIComponent(project.id)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          id: project.id,
          title: project.title,
          baseVersion: project.sync.remoteVersion,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          lastOpenedAt: project.lastOpenedAt,
        }),
      },
    );
    return result.project;
  }

  async putCanvas(document: CanvasDocument) {
    const result = await this.request<{ canvas: RemoteCanvas }>(
      `/v1/canvases/${encodeURIComponent(document.id)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          id: document.id,
          title: document.title,
          projectId: document.projectId,
          baseVersion: document.sync.remoteVersion,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
          lastOpenedAt: document.lastOpenedAt,
          scene: document.scene,
        }),
      },
    );
    return result.canvas;
  }

  deleteProject(projectId: string, baseVersion: number) {
    return this.request<{ deletedCanvasIds: string[] }>(
      `/v1/projects/${encodeURIComponent(
        projectId,
      )}?baseVersion=${baseVersion}`,
      { method: "DELETE" },
    );
  }

  deleteCanvas(canvasId: string, baseVersion: number) {
    return this.request<void>(
      `/v1/canvases/${encodeURIComponent(canvasId)}?baseVersion=${baseVersion}`,
      { method: "DELETE" },
    );
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getIdToken();
    const abortController = new AbortController();
    const timeout = window.setTimeout(() => abortController.abort(), 20_000);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
        signal: abortController.signal,
      });
    } finally {
      window.clearTimeout(timeout);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const data = (await response.json()) as {
      error?: { code?: string; message?: string };
    } & T;
    if (!response.ok) {
      throw new WorkspaceApiError(
        response.status,
        data.error?.code || "request_failed",
        data.error?.message || "Workspace request failed.",
      );
    }
    return data;
  }
}
