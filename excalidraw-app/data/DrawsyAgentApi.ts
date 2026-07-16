export type DrawsyCanvasSnapshot = {
  canvasId: string;
  canvasName: string;
  elements: readonly unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
};

export type DrawsyCanvasOperations = {
  upsertElements: unknown[];
  deleteElementIds: string[];
  files: DrawsyCanvasFile[];
};

export type DrawsyCanvasFile = {
  id: string;
  mimeType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  dataURL: string;
  created: number;
};

export type DrawsyCanvasContextBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DrawsyCanvasContextRequest = {
  elementIds?: string[];
  bounds?: DrawsyCanvasContextBounds;
  includeSourceImages: boolean;
  maxDimension: number;
};

export type DrawsyCanvasContextCapture = {
  id: string;
  elementIds: string[];
  bounds: DrawsyCanvasContextBounds;
  preview: { mimeType: "image/png"; dataURL: string };
  sourceImages: Array<{
    id: string;
    mimeType: DrawsyCanvasFile["mimeType"];
    dataURL: string;
  }>;
};

export type DrawsyCanvasImageReplacement = {
  targetElementId: string;
  file: DrawsyCanvasFile;
  naturalWidth: number;
  naturalHeight: number;
};

export type DrawsyAgentMetadata = {
  model: string;
  modelProvider: string;
  reasoningEffort: string | null;
  serviceTier: string | null;
};

export type DrawsyAgentAccessMode = "workspace" | "readOnly";

export type DrawsyDrawDocument =
  | { exists: false }
  | {
      exists: true;
      name: "DRAW.md";
      content: string;
      hash: string;
      sourceId: string;
    };

export type DrawsySurfaceKind =
  | "canvas"
  | "presentation"
  | "kanban"
  | "jira"
  | "neutral";

export type DrawsyConnectedSource = {
  connectionId: string;
  capability:
    | "mail"
    | "calendar"
    | "drive"
    | "notion"
    | "slack"
    | "github"
    | "read-ai"
    | "fireflies"
    | "aws";
  label: string;
  accountLabel: string;
};

export type DrawsyConnectorTurn = {
  turnId: string;
  sources: DrawsyConnectedSource[];
  grants: Array<{
    connectionId: string;
    grant: string;
    expiresAt: number;
  }>;
};

export type DrawsyResourceId = "kanban" | "jira";

export type DrawsyResourceTurn = {
  turnId: string;
  resources: DrawsyResourceId[];
  grant: string;
  expiresAt: number;
};

export type DrawsyAgentControls = {
  accessMode: DrawsyAgentAccessMode;
  internetEnabled: boolean;
  models: Array<{
    id: string;
    model: string;
    displayName: string;
    description: string;
    efforts: Array<{ id: string; description: string }>;
    defaultEffort: string;
    isDefault: boolean;
  }>;
  skills: Array<{
    name: string;
    displayName: string;
    description: string;
    path: string;
  }>;
  plugins: Array<{
    id: string;
    name: string;
    description: string;
    capabilities: string[];
    path: string;
  }>;
  mcpServers: Array<{
    name: string;
    toolCount: number;
    authStatus: string;
  }>;
};

export type DrawsyBridgeEvent =
  | {
      type: "session.ready";
      data: { folderName: string; agent: DrawsyAgentMetadata };
    }
  | { type: "assistant.delta"; data: { delta: string; itemId: string } }
  | { type: "assistant.final"; data: { text: string; itemId: string } }
  | { type: "turn.status"; data: { status: string; error?: string } }
  | {
      type: "tool.status";
      data: {
        itemId: string;
        tool: string;
        status: "inProgress" | "completed" | "failed" | "warning";
        message?: string;
        error?: string;
      };
    }
  | {
      type: "canvas.request";
      data: {
        requestId: string;
        action: "read" | "apply" | "capture" | "replaceImage";
        canvasId: string;
        operations?: DrawsyCanvasOperations;
        contextRequest?: DrawsyCanvasContextRequest;
        imageReplacement?: DrawsyCanvasImageReplacement;
      };
    }
  | { type: "error"; data: { message: string; code: string } };

type ApiErrorBody = { error?: { message?: string } };

const apiBase =
  import.meta.env.VITE_APP_DRAWSY_AGENT_URL || "http://127.0.0.1:3031";

const parseResponse = async <T>(response: Response): Promise<T> => {
  const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!response.ok) {
    throw new Error(
      body.error?.message || `Drawsy AI request failed (${response.status}).`,
    );
  }
  return body;
};

export const DrawsyAgentApi = {
  pickFolder: async () =>
    parseResponse<{ selectionId: string; name: string }>(
      await fetch(`${apiBase}/v1/folders/pick`, { method: "POST" }),
    ),

  readDrawDocument: async (selectionId: string) =>
    parseResponse<DrawsyDrawDocument>(
      await fetch(
        `${apiBase}/v1/folders/${encodeURIComponent(
          selectionId,
        )}/draw-document`,
      ),
    ),

  createSession: async (input: {
    selectionId: string;
    canvasId?: string | null;
    canvasName?: string | null;
    surfaceKind: DrawsySurfaceKind;
    surfaceId?: string | null;
    surfaceName?: string | null;
  }) =>
    parseResponse<{ id: string; token: string; folderName: string }>(
      await fetch(`${apiBase}/v1/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
    ),

  streamEvents: async (
    session: { id: string; token: string },
    signal: AbortSignal,
    onEvent: (event: DrawsyBridgeEvent) => void,
  ) => {
    const response = await fetch(
      `${apiBase}/v1/sessions/${session.id}/events`,
      {
        headers: { authorization: `Bearer ${session.token}` },
        signal,
      },
    );
    if (!response.ok || !response.body) {
      await parseResponse(response);
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) {
          onEvent(JSON.parse(line) as DrawsyBridgeEvent);
        }
        newline = buffer.indexOf("\n");
      }
    }
    if (!signal.aborted) {
      throw new Error("The local Drawsy AI connection closed.");
    }
  },

  startTurn: async (
    session: { id: string; token: string },
    message: string,
    tags: {
      skills: Array<{ name: string; path: string }>;
      plugins: Array<{ name: string; path: string }>;
    },
    contexts: Array<{
      id: string;
      elementIds: string[];
      bounds: DrawsyCanvasContextBounds;
    }> = [],
    connectors?: DrawsyConnectorTurn,
    resources?: DrawsyResourceTurn,
  ) =>
    parseResponse<{ accepted: true }>(
      await fetch(`${apiBase}/v1/sessions/${session.id}/turns`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message,
          ...tags,
          contexts,
          ...(connectors ? { connectors } : {}),
          ...(resources ? { resources } : {}),
        }),
      }),
    ),

  uploadContextAsset: async (
    session: { id: string; token: string },
    input: {
      captureId: string;
      role: "preview" | "source";
      assetId: string;
      blob: Blob;
    },
  ) =>
    parseResponse<{ id: string; mimeType: string }>(
      await fetch(
        `${apiBase}/v1/sessions/${
          session.id
        }/context-assets/${encodeURIComponent(input.captureId)}/${
          input.role
        }/${encodeURIComponent(input.assetId)}`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${session.token}`,
            "content-type": input.blob.type,
          },
          body: input.blob,
        },
      ),
    ),

  getControls: async (session: { id: string; token: string }) =>
    parseResponse<DrawsyAgentControls>(
      await fetch(`${apiBase}/v1/sessions/${session.id}/controls`, {
        headers: { authorization: `Bearer ${session.token}` },
      }),
    ),

  updateSettings: async (
    session: { id: string; token: string },
    settings: {
      model?: string;
      effort?: string;
      accessMode?: DrawsyAgentAccessMode;
      internetEnabled?: boolean;
    },
  ) =>
    parseResponse<{
      agent: DrawsyAgentMetadata;
      controls: DrawsyAgentControls;
    }>(
      await fetch(`${apiBase}/v1/sessions/${session.id}/settings`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(settings),
      }),
    ),

  respondToCanvas: async (
    session: { id: string; token: string },
    response: {
      requestId: string;
      ok: boolean;
      data?: unknown;
      error?: string;
    },
  ) =>
    parseResponse<{ accepted: true }>(
      await fetch(`${apiBase}/v1/sessions/${session.id}/canvas-responses`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(response),
      }),
    ),

  closeSession: async (session: { id: string; token: string }) => {
    await fetch(`${apiBase}/v1/sessions/${session.id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${session.token}` },
      keepalive: true,
    }).catch(() => undefined);
  },
};
