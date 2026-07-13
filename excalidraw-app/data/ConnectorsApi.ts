export type ConnectorCapability =
  | "mail"
  | "calendar"
  | "drive"
  | "notion"
  | "slack"
  | "github";

export type ConnectorProvider = {
  id: string;
  name: string;
  capabilities: readonly ConnectorCapability[];
  executionMode: "provider_api" | "remote_mcp";
  availability: "preview" | "stable";
  configured: boolean;
};

export type ConnectorConnection = {
  id: string;
  providerId: string;
  accountId: string;
  accountName: string;
  accountEmail: string | null;
  accountAvatarUrl: string | null;
  capabilities: ConnectorCapability[];
  scopes: string[];
  createdAt: number;
  updatedAt: number;
};

export type ConnectorsOverview = {
  providers: ConnectorProvider[];
  connections: ConnectorConnection[];
};

type TokenProvider = () => Promise<string>;

export class ConnectorsApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "ConnectorsApiError";
  }
}

export class ConnectorsApi {
  private readonly baseUrl: string;

  constructor(private readonly getIdToken: TokenProvider) {
    const configuredUrl = import.meta.env.VITE_APP_DRAWSY_BACKEND_URL?.trim();
    if (!configuredUrl) {
      throw new Error("VITE_APP_DRAWSY_BACKEND_URL is not configured");
    }
    this.baseUrl = configuredUrl.replace(/\/$/, "");
  }

  getOverview() {
    return this.request<ConnectorsOverview>("/v1/connectors");
  }

  async connect(providerId: string) {
    const popup = window.open(
      "about:blank",
      `drawsy-connector-${providerId}`,
      "popup,width=720,height=780",
    );
    if (!popup) {
      throw new ConnectorsApiError(
        0,
        "popup_blocked",
        "Allow popups to connect this source.",
      );
    }
    let authorizationUrl: string;
    let attemptId: string;
    try {
      ({ authorizationUrl, attemptId } = await this.request<{
        authorizationUrl: string;
        attemptId: string;
      }>(`/v1/connectors/${encodeURIComponent(providerId)}/oauth/start`, {
        method: "POST",
      }));
      popup.location.replace(authorizationUrl);
    } catch (error) {
      popup.close();
      throw error;
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let checking = false;
      let closedAt: number | null = null;
      const timeout = window.setTimeout(
        () =>
          finish(
            new ConnectorsApiError(
              0,
              "oauth_timeout",
              "The connection took too long. Try again.",
            ),
          ),
        10 * 60 * 1000,
      );
      const checkStatus = async () => {
        if (settled || checking) {
          return;
        }
        checking = true;
        try {
          const result = await this.request<{
            status: "pending" | "connected" | "failed";
            error?: string;
          }>(`/v1/connectors/oauth/attempts/${encodeURIComponent(attemptId)}`);
          if (result.status === "connected") {
            finish();
            return;
          }
          if (result.status === "failed") {
            finish(
              new ConnectorsApiError(
                0,
                result.error || "oauth_failed",
                result.error === "access_denied"
                  ? "Access was not granted. Connect again when you’re ready."
                  : "This source could not be connected. Check access and try again.",
              ),
            );
            return;
          }
          if (popup.closed) {
            closedAt ??= Date.now();
            if (Date.now() - closedAt >= 3_000) {
              finish(
                new ConnectorsApiError(
                  0,
                  "oauth_incomplete",
                  "The connection wasn’t completed. Try again.",
                ),
              );
            }
          }
        } catch (error) {
          if (popup.closed) {
            finish(
              error instanceof Error
                ? error
                : new Error("The connection could not be verified."),
            );
          }
        } finally {
          checking = false;
        }
      };
      const poll = window.setInterval(() => void checkStatus(), 600);
      const onMessage = (event: MessageEvent) => {
        if (
          event.origin === window.location.origin &&
          event.source === popup &&
          event.data?.type === "drawsy:connector-oauth" &&
          (!event.data.provider || event.data.provider === providerId)
        ) {
          void checkStatus();
        }
      };
      const finish = (error?: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        window.clearInterval(poll);
        window.removeEventListener("message", onMessage);
        if (!popup.closed) {
          popup.close();
        }
        error ? reject(error) : resolve();
      };
      window.addEventListener("message", onMessage);
    });

    return this.getOverview();
  }

  disconnect(connectionId: string) {
    return this.request<void>(
      `/v1/connectors/connections/${encodeURIComponent(connectionId)}`,
      { method: "DELETE" },
    );
  }

  private async request<T>(path: string, init: RequestInit = {}) {
    const token = await this.getIdToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string };
      };
      throw new ConnectorsApiError(
        response.status,
        data.error?.code || "request_failed",
        data.error?.message || "The connector request failed.",
      );
    }
    return response.status === 204
      ? (undefined as T)
      : ((await response.json()) as T);
  }
}
