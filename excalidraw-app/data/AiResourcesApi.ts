export type AiResourceId = "kanban" | "jira";

type TokenProvider = () => Promise<string>;

export class AiResourcesApi {
  private readonly baseUrl: string;

  constructor(private readonly getIdToken: TokenProvider) {
    const configuredUrl = import.meta.env.VITE_APP_DRAWSY_BACKEND_URL?.trim();
    if (!configuredUrl) {
      throw new Error("VITE_APP_DRAWSY_BACKEND_URL is not configured");
    }
    this.baseUrl = configuredUrl.replace(/\/$/, "");
  }

  async createGrant(input: {
    sessionId: string;
    turnId: string;
    resources: AiResourceId[];
  }) {
    const token = await this.getIdToken();
    const response = await fetch(`${this.baseUrl}/v1/ai/resources/grants`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    });
    const body = (await response.json().catch(() => ({}))) as {
      grant?: string;
      expiresAt?: number;
      error?: { message?: string };
    };
    if (!response.ok || !body.grant || !body.expiresAt) {
      throw new Error(
        body.error?.message ||
          `Drawsy resources could not be attached (${response.status}).`,
      );
    }
    return { grant: body.grant, expiresAt: body.expiresAt };
  }
}
