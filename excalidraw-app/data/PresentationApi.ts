import type {
  PresentationDocument,
  PresentationDocumentMetadata,
} from "./PresentationStore";

type RemotePresentation = Omit<PresentationDocumentMetadata, "sync"> & {
  contentHash: string | null;
};

export type RemotePresentations = {
  presentations: RemotePresentation[];
};

type TokenProvider = () => Promise<string>;

export class PresentationApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "PresentationApiError";
  }
}

export class PresentationApi {
  private readonly baseUrl: string;

  constructor(private readonly getIdToken: TokenProvider) {
    const configuredUrl = import.meta.env.VITE_APP_DRAWSY_BACKEND_URL?.trim();
    if (!configuredUrl) {
      throw new Error("VITE_APP_DRAWSY_BACKEND_URL is not configured");
    }
    this.baseUrl = configuredUrl.replace(/\/$/, "");
  }

  getPresentations() {
    return this.request<RemotePresentations>("/v1/presentations");
  }

  async getPresentationScene(presentationId: string) {
    const result = await this.request<{
      scene: PresentationDocument["scene"];
    }>(`/v1/presentations/${encodeURIComponent(presentationId)}/scene`);
    return result.scene;
  }

  async putPresentation(document: PresentationDocument) {
    const result = await this.request<{ presentation: RemotePresentation }>(
      `/v1/presentations/${encodeURIComponent(document.id)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          id: document.id,
          title: document.title,
          baseVersion: document.sync.remoteVersion,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
          lastOpenedAt: document.lastOpenedAt,
          scene: document.scene,
        }),
      },
    );
    return result.presentation;
  }

  async patchPresentation(document: PresentationDocument) {
    const result = await this.request<{ presentation: RemotePresentation }>(
      `/v1/presentations/${encodeURIComponent(document.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          id: document.id,
          title: document.title,
          baseVersion: document.sync.remoteVersion,
          lastOpenedAt: document.lastOpenedAt,
        }),
      },
    );
    return result.presentation;
  }

  deletePresentation(presentationId: string, baseVersion: number) {
    return this.request<void>(
      `/v1/presentations/${encodeURIComponent(
        presentationId,
      )}?baseVersion=${baseVersion}`,
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
      throw new PresentationApiError(
        response.status,
        data.error?.code || "request_failed",
        data.error?.message || "Presentation request failed.",
      );
    }
    return data;
  }
}
