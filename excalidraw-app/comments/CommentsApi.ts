import type { CanvasComment, CommentAnchor } from "./types";

type TokenProvider = () => Promise<string>;

export class CommentsApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "CommentsApiError";
  }
}

export class CommentsApi {
  private readonly baseUrl: string;

  constructor(private readonly getIdToken: TokenProvider) {
    const configuredUrl = import.meta.env.VITE_APP_DRAWSY_BACKEND_URL?.trim();
    if (!configuredUrl) {
      throw new Error("VITE_APP_DRAWSY_BACKEND_URL is not configured");
    }
    this.baseUrl = configuredUrl.replace(/\/$/, "");
  }

  list(canvasId: string) {
    return this.request<{ comments: CanvasComment[] }>(this.path(canvasId));
  }

  create(
    canvasId: string,
    input: CommentAnchor & {
      id: string;
      messageId: string;
      body: string;
    },
  ) {
    return this.request<{ comment: CanvasComment }>(this.path(canvasId), {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  delete(comment: CanvasComment) {
    return this.request<void>(
      `${this.path(comment.canvasId)}/${comment.id}?baseVersion=${
        comment.version
      }`,
      { method: "DELETE" },
    );
  }

  private path(canvasId: string) {
    return `/v1/canvases/${encodeURIComponent(canvasId)}/comments`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getIdToken();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
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
        signal: controller.signal,
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
      throw new CommentsApiError(
        response.status,
        data.error?.code || "request_failed",
        data.error?.message || "Comment request failed.",
      );
    }
    return data;
  }
}
