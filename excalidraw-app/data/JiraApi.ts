export type JiraSite = {
  id: string;
  name: string;
  url: string;
  avatarUrl?: string;
  scopes: string[];
};

export type JiraConnection = {
  id: string;
  accountId: string;
  accountName: string;
  accountEmail: string | null;
  accountAvatarUrl: string | null;
  sites: JiraSite[];
};

type TokenProvider = () => Promise<string>;

export class JiraApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "JiraApiError";
  }
}

export class JiraApi {
  private readonly baseUrl: string;

  constructor(private readonly getIdToken: TokenProvider) {
    const configuredUrl = import.meta.env.VITE_APP_DRAWSY_BACKEND_URL?.trim();
    if (!configuredUrl) {
      throw new Error("VITE_APP_DRAWSY_BACKEND_URL is not configured");
    }
    this.baseUrl = configuredUrl.replace(/\/$/, "");
  }

  async connect() {
    const { authorizationUrl, attemptId } = await this.request<{
      authorizationUrl: string;
      attemptId: string;
    }>("/v1/jira/oauth/start", { method: "POST" });
    const popup = window.open(
      authorizationUrl,
      "drawsy-jira-oauth",
      "popup,width=720,height=780",
    );
    if (!popup) {
      throw new JiraApiError(
        0,
        "popup_blocked",
        "Allow popups to connect Jira.",
      );
    }
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let checking = false;
      let closedAt: number | null = null;
      const timeout = window.setTimeout(
        () =>
          finish(
            new JiraApiError(
              0,
              "oauth_timeout",
              "Jira took too long to connect. Try again.",
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
          }>(`/v1/jira/oauth/attempts/${encodeURIComponent(attemptId)}`);
          if (result.status === "connected") {
            finish();
            return;
          }
          if (result.status === "failed") {
            const denied = result.error === "access_denied";
            finish(
              new JiraApiError(
                0,
                result.error || "oauth_failed",
                denied
                  ? "Jira access was not granted. Connect again when you’re ready."
                  : "Jira could not be connected. Check access and try again.",
              ),
            );
            return;
          }
          if (popup.closed) {
            closedAt ??= Date.now();
            if (Date.now() - closedAt >= 3_000) {
              finish(
                new JiraApiError(
                  0,
                  "oauth_incomplete",
                  "Jira connection wasn’t completed. Try again.",
                ),
              );
            }
          }
        } catch (error) {
          if (popup.closed) {
            finish(
              error instanceof Error
                ? error
                : new Error("Jira connection could not be verified."),
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
          event.data?.type === "drawsy:jira-oauth"
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
    return this.listConnections();
  }

  async listConnections() {
    return (
      await this.request<{ connections: JiraConnection[] }>(
        "/v1/jira/connections",
      )
    ).connections;
  }

  disconnect(connectionId: string) {
    return this.request<void>(
      `/v1/jira/connections/${encodeURIComponent(connectionId)}`,
      { method: "DELETE" },
    );
  }

  projects(connectionId: string, cloudId: string) {
    return this.scoped<{ values: JiraProject[] }>(
      connectionId,
      cloudId,
      "/projects",
    );
  }

  boards(connectionId: string, cloudId: string, projectKey?: string) {
    return this.scoped<{ values: JiraBoard[] }>(
      connectionId,
      cloudId,
      projectKey
        ? `/boards?projectKey=${encodeURIComponent(projectKey)}`
        : "/boards",
    );
  }

  async searchIssues(connectionId: string, cloudId: string, jql: string) {
    const issues: JiraRemoteIssue[] = [];
    let nextPageToken: string | undefined;
    let pageCount = 0;
    do {
      const requestedPageToken = nextPageToken;
      const page: {
        issues: JiraRemoteIssue[];
        nextPageToken?: string;
      } = await this.scoped(connectionId, cloudId, "/issues/search", {
        method: "POST",
        body: JSON.stringify({ jql, maxResults: 100, nextPageToken }),
      });
      issues.push(...page.issues);
      nextPageToken = page.nextPageToken;
      pageCount += 1;
      if (nextPageToken === requestedPageToken) {
        break;
      }
    } while (nextPageToken && pageCount < 10);
    return { issues, nextPageToken };
  }

  issue(connectionId: string, cloudId: string, issueKey: string) {
    return this.scoped<JiraRemoteIssue>(
      connectionId,
      cloudId,
      `/issues/${encodeURIComponent(issueKey)}`,
    );
  }

  assignableUsers(connectionId: string, cloudId: string, projectKey: string) {
    return this.scoped<JiraUser[]>(
      connectionId,
      cloudId,
      `/users/assignable?projectKey=${encodeURIComponent(projectKey)}`,
    );
  }

  priorities(connectionId: string, cloudId: string) {
    return this.scoped<{ values: Array<{ id: string; name: string }> }>(
      connectionId,
      cloudId,
      "/priorities",
    );
  }

  createIssue(
    connectionId: string,
    cloudId: string,
    fields: Record<string, unknown>,
  ) {
    return this.scoped<{ id: string; key: string }>(
      connectionId,
      cloudId,
      "/issues",
      {
        method: "POST",
        body: JSON.stringify({ fields }),
      },
    );
  }

  updateIssue(
    connectionId: string,
    cloudId: string,
    issueKey: string,
    fields: Record<string, unknown>,
  ) {
    return this.scoped<void>(
      connectionId,
      cloudId,
      `/issues/${encodeURIComponent(issueKey)}`,
      {
        method: "PUT",
        body: JSON.stringify({ fields }),
      },
    );
  }

  async transitionIssue(
    connectionId: string,
    cloudId: string,
    issueKey: string,
    statusName: string,
  ) {
    const { transitions } = await this.scoped<{
      transitions: Array<{
        id: string;
        name: string;
        to: { name: string; statusCategory?: { key: string } };
      }>;
    }>(
      connectionId,
      cloudId,
      `/issues/${encodeURIComponent(issueKey)}/transitions`,
    );
    const normalizedTarget = statusName.toLowerCase();
    const transition =
      transitions.find(
        (candidate) => candidate.to.name.toLowerCase() === normalizedTarget,
      ) ||
      transitions.find((candidate) => {
        const name = candidate.to.name.toLowerCase();
        const category = candidate.to.statusCategory?.key?.toLowerCase();
        if (normalizedTarget === "done") {
          return category === "done";
        }
        if (normalizedTarget === "to do") {
          return category === "new";
        }
        if (normalizedTarget === "in review") {
          return name.includes("review");
        }
        return category === "indeterminate" && !name.includes("review");
      });
    if (!transition) {
      throw new JiraApiError(
        400,
        "transition_unavailable",
        `Jira does not allow moving this issue to ${statusName}.`,
      );
    }
    return this.scoped<void>(
      connectionId,
      cloudId,
      `/issues/${encodeURIComponent(issueKey)}/transitions`,
      {
        method: "POST",
        body: JSON.stringify({ transition: { id: transition.id } }),
      },
    );
  }

  addComment(
    connectionId: string,
    cloudId: string,
    issueKey: string,
    text: string,
  ) {
    return this.scoped(
      connectionId,
      cloudId,
      `/issues/${encodeURIComponent(issueKey)}/comments`,
      { method: "POST", body: JSON.stringify({ body: toAdf(text) }) },
    );
  }

  sprints(connectionId: string, cloudId: string, boardId: string) {
    return this.scoped<{ values: JiraSprint[] }>(
      connectionId,
      cloudId,
      `/boards/${encodeURIComponent(boardId)}/sprints`,
    );
  }

  updateSprint(
    connectionId: string,
    cloudId: string,
    sprintId: string,
    state: "active" | "closed",
  ) {
    return this.scoped<JiraSprint>(
      connectionId,
      cloudId,
      `/sprints/${encodeURIComponent(sprintId)}`,
      { method: "PUT", body: JSON.stringify({ state }) },
    );
  }

  backlog(connectionId: string, cloudId: string, boardId: string) {
    return this.scoped<{ issues: JiraRemoteIssue[] }>(
      connectionId,
      cloudId,
      `/boards/${encodeURIComponent(boardId)}/backlog`,
    );
  }

  serviceDesks(connectionId: string, cloudId: string) {
    return this.scoped<{
      values: Array<{ id: string; projectId: string; projectName: string }>;
    }>(connectionId, cloudId, "/service-desks");
  }

  queues(connectionId: string, cloudId: string, serviceDeskId: string) {
    return this.scoped<{
      values: Array<{ id: string; name: string; issueCount: number }>;
    }>(
      connectionId,
      cloudId,
      `/service-desks/${encodeURIComponent(serviceDeskId)}/queues`,
    );
  }

  queueIssues(
    connectionId: string,
    cloudId: string,
    serviceDeskId: string,
    queueId: string,
  ) {
    return this.scoped<{ values: JiraRemoteIssue[] }>(
      connectionId,
      cloudId,
      `/service-desks/${encodeURIComponent(
        serviceDeskId,
      )}/queues/${encodeURIComponent(queueId)}/issues`,
    );
  }

  private scoped<T>(
    connectionId: string,
    cloudId: string,
    suffix: string,
    init?: RequestInit,
  ) {
    return this.request<T>(
      `/v1/jira/connections/${encodeURIComponent(
        connectionId,
      )}/sites/${encodeURIComponent(cloudId)}${suffix}`,
      init,
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
      throw new JiraApiError(
        response.status,
        data.error?.code || "request_failed",
        data.error?.message || "Jira request failed.",
      );
    }
    return response.status === 204
      ? (undefined as T)
      : ((await response.json()) as T);
  }
}

export type JiraProject = {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  avatarUrls?: Record<string, string>;
  issueTypes?: Array<{ id: string; name: string; subtask: boolean }>;
};

export type JiraBoard = {
  id: number;
  name: string;
  type: string;
  location?: { projectId?: number; projectKey?: string; name?: string };
};
export type JiraSprint = {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
};
export type JiraRemoteIssue = {
  id: string;
  key: string;
  fields: Record<string, any>;
};
export type JiraUser = {
  accountId: string;
  displayName: string;
  active: boolean;
  avatarUrls?: Record<string, string>;
};

export const toAdf = (text: string) => ({
  type: "doc",
  version: 1,
  content: text
    ? [{ type: "paragraph", content: [{ type: "text", text }] }]
    : [],
});

export const fromAdf = (value: unknown): string => {
  if (!value || typeof value !== "object") {
    return "";
  }
  const collect = (node: any): string =>
    typeof node?.text === "string"
      ? node.text
      : Array.isArray(node?.content)
      ? node.content.map(collect).join(node.type === "doc" ? "\n" : "")
      : "";
  return collect(value);
};
