export type RemoteKanbanRole = "owner" | "editor" | "viewer";

export type RemoteKanbanBoardSummary = {
  id: string;
  title: string;
  role: RemoteKanbanRole;
  revision: number;
  status: "active" | "trashed";
  updatedAt: number;
};

export type RemoteKanbanColumn = {
  id: string;
  boardId: string;
  title: string;
  rank: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

export type RemoteKanbanCard = {
  id: string;
  boardId: string;
  columnId: string;
  rank: string;
  version: number;
  fieldVersions: Record<string, number>;
  assigneeIds: string[];
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | null;
  progress: number;
  dueDate: string | null;
  legacyAssigneeText: string | null;
  legacyCanvasTags: string[];
  createdBy: string;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

export type RemoteKanbanChecklistItem = {
  id: string;
  boardId: string;
  cardId: string;
  rank: string;
  completed: boolean;
  version: number;
  fieldVersions: Record<string, number>;
  title: string;
  createdBy: string;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

export type RemoteKanbanCanvasLink = {
  id: string;
  boardId: string;
  cardId: string;
  canvasId: string;
  state: "available" | "restricted";
  title?: string;
  createdAt: number;
};

export type RemoteKanbanMember = {
  userId: string;
  role: RemoteKanbanRole;
  membershipVersion: number;
  invitedBy: string | null;
  joinedAt: number;
  updatedAt: number;
};

export type RemoteKanbanSnapshot = {
  board: {
    id: string;
    schemaVersion: 2;
    ownerId: string;
    role: RemoteKanbanRole;
    revision: number;
    status: "active" | "trashed";
    title: string;
    roughness: 0 | 1 | 2;
    cardRadius: 0 | 1 | 2;
    isLocked: boolean;
    createdAt: number;
    updatedAt: number;
    trashedAt: number | null;
  };
  columns: RemoteKanbanColumn[];
  cards: RemoteKanbanCard[];
  checklistItems: RemoteKanbanChecklistItem[];
  canvasLinks: RemoteKanbanCanvasLink[];
  members: RemoteKanbanMember[];
};

export type RemoteKanbanChange = {
  revision: number;
  type: string;
  entityType: "board" | "column" | "card" | "checklist" | "canvasLink";
  entityId: string;
  deleted: boolean;
  value: unknown;
  actorId: string;
  createdAt: number;
};

export type KanbanCommand = {
  operationId: string;
  clientSequence: number;
  knownBoardRevision: number;
  type: string;
  entityId?: string;
  baseVersion?: number;
  baseFieldVersions?: Record<string, number>;
  payload: Record<string, unknown>;
};

export type KanbanCommandResult = {
  operationId: string;
  status: "applied" | "duplicate" | "conflict" | "rejected";
  revision: number;
  code?: string;
  message?: string;
  change?: RemoteKanbanChange;
};

type TokenProvider = () => Promise<string>;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_EVENT_BUFFER_SIZE = 64 * 1024;

export class KanbanApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "KanbanApiError";
  }
}

export class KanbanApi {
  private readonly baseUrl: string;

  constructor(private readonly getIdToken: TokenProvider) {
    const configuredUrl = import.meta.env.VITE_APP_DRAWSY_BACKEND_URL?.trim();
    if (!configuredUrl) {
      throw new Error("VITE_APP_DRAWSY_BACKEND_URL is not configured");
    }
    this.baseUrl = configuredUrl.replace(/\/$/, "");
  }

  async listBoards() {
    return (
      await this.request<{ boards: RemoteKanbanBoardSummary[] }>(
        "/v1/kanban/boards",
      )
    ).boards;
  }

  async createBoard(input: {
    id: string;
    title: string;
    initialColumnId: string;
    initialColumnTitle: string;
    columns?: Array<{ id: string; title: string }>;
  }) {
    return (
      await this.request<{ snapshot: RemoteKanbanSnapshot }>(
        "/v1/kanban/boards",
        { method: "POST", body: JSON.stringify(input) },
      )
    ).snapshot;
  }

  async getSnapshot(boardId: string) {
    return (
      await this.request<{ snapshot: RemoteKanbanSnapshot }>(
        `/v1/kanban/boards/${encodeURIComponent(boardId)}/snapshot`,
      )
    ).snapshot;
  }

  getChanges(boardId: string, afterRevision: number) {
    return this.request<{
      changes: RemoteKanbanChange[];
      latestRevision: number;
    }>(
      `/v1/kanban/boards/${encodeURIComponent(
        boardId,
      )}/changes?afterRevision=${afterRevision}`,
    );
  }

  async applyCommands(
    boardId: string,
    clientId: string,
    commands: KanbanCommand[],
  ) {
    return (
      await this.request<{ results: KanbanCommandResult[] }>(
        `/v1/kanban/boards/${encodeURIComponent(boardId)}/commands`,
        {
          method: "POST",
          body: JSON.stringify({ clientId, commands }),
        },
      )
    ).results;
  }

  async listMembers(boardId: string) {
    return (
      await this.request<{ members: RemoteKanbanMember[] }>(
        `/v1/kanban/boards/${encodeURIComponent(boardId)}/members`,
      )
    ).members;
  }

  createInvitation(
    boardId: string,
    input: { email: string; role: "editor" | "viewer"; expiresInHours: number },
  ) {
    return this.request<{
      invitation: {
        id: string;
        boardId: string;
        email: string;
        role: "editor" | "viewer";
        status: string;
        expiresAt: number;
      };
      token: string;
    }>(`/v1/kanban/boards/${encodeURIComponent(boardId)}/invitations`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  revokeInvitation(boardId: string, invitationId: string) {
    return this.request<void>(
      `/v1/kanban/boards/${encodeURIComponent(
        boardId,
      )}/invitations/${encodeURIComponent(invitationId)}`,
      { method: "DELETE" },
    );
  }

  inspectInvitation(token: string) {
    return this.request<{
      boardTitle: string;
      role: "editor" | "viewer";
      expiresAt: number;
    }>("/v1/kanban/invitations/inspect", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  }

  async acceptInvitation(token: string) {
    return (
      await this.request<{ board: RemoteKanbanBoardSummary }>(
        "/v1/kanban/invitations/accept",
        { method: "POST", body: JSON.stringify({ token }) },
      )
    ).board;
  }

  connectEvents(
    boardId: string,
    onEvent: (event: {
      type: "revision" | "role_changed" | "access_revoked";
      latestRevision?: number;
      role?: RemoteKanbanRole;
      membershipVersion?: number;
    }) => void,
    onDisconnect: (error?: Error) => void,
  ) {
    const controller = new AbortController();
    void this.consumeEvents(boardId, controller.signal, onEvent)
      .then(() => onDisconnect())
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          onDisconnect(
            error instanceof Error ? error : new Error("Stream failed"),
          );
        }
      });
    return () => controller.abort();
  }

  private async consumeEvents(
    boardId: string,
    signal: AbortSignal,
    onEvent: (event: {
      type: "revision" | "role_changed" | "access_revoked";
      latestRevision?: number;
      role?: RemoteKanbanRole;
      membershipVersion?: number;
    }) => void,
  ) {
    const token = await this.getIdToken();
    const response = await fetch(
      `${this.baseUrl}/v1/kanban/boards/${encodeURIComponent(boardId)}/events`,
      {
        cache: "no-store",
        headers: {
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
          Authorization: `Bearer ${token}`,
        },
        signal,
      },
    );
    if (!response.ok || !response.body) {
      throw await this.toError(response);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer = `${buffer}${decoder.decode(value, { stream: true })}`.replace(
        /\r\n/g,
        "\n",
      );
      if (buffer.length > MAX_EVENT_BUFFER_SIZE) {
        throw new Error("Kanban event frame exceeded the client limit");
      }
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        if (data) {
          const event = JSON.parse(data) as { type?: unknown };
          if (
            event.type === "revision" ||
            event.type === "role_changed" ||
            event.type === "access_revoked"
          ) {
            onEvent(event as Parameters<typeof onEvent>[0]);
          }
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getIdToken();
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-store",
          Authorization: `Bearer ${token}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw await this.toError(response);
      }
      if (response.status === 204) {
        return undefined as T;
      }
      return (await response.json()) as T;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private async toError(response: Response) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    };
    return new KanbanApiError(
      response.status,
      data.error?.code || "request_failed",
      data.error?.message || "Kanban request failed.",
    );
  }
}
