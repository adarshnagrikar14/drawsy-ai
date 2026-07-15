import { ConnectorsApi } from "../data/ConnectorsApi";

describe("ConnectorsApi", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_APP_DRAWSY_BACKEND_URL", "https://backend.example");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("loads the authenticated connector overview", async () => {
    const overview = {
      providers: [
        {
          id: "google-workspace",
          name: "Google Workspace",
          capabilities: ["mail", "calendar", "drive"],
          executionMode: "provider_api",
          availability: "preview",
          configured: true,
        },
      ],
      connections: [],
    };
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(overview), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const api = new ConnectorsApi(() => Promise.resolve("firebase-token"));

    await expect(api.getOverview()).resolves.toEqual(overview);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.example/v1/connectors",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: "Bearer firebase-token",
        }),
      }),
    );
  });

  it("disconnects the selected connection", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = new ConnectorsApi(() => Promise.resolve("firebase-token"));

    await expect(api.disconnect("account/one")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.example/v1/connectors/connections/account%2Fone",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("creates an authenticated turn-scoped AI grant", async () => {
    const grant = {
      grant: "opaque-grant",
      expiresAt: 1_800_000_000_000,
      connectionId: "google-one",
      capabilities: ["mail", "drive"],
    };
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(grant), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = new ConnectorsApi(() => Promise.resolve("firebase-token"));
    const input = {
      sessionId: "session-one",
      turnId: "turn-one",
      connectionId: "google-one",
      capabilities: ["mail", "drive"] as const,
    };

    await expect(
      api.createAiGrant({ ...input, capabilities: [...input.capabilities] }),
    ).resolves.toEqual({
      grant: "opaque-grant",
      expiresAt: 1_800_000_000_000,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.example/v1/connectors/ai/grants",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
        headers: expect.objectContaining({
          Authorization: "Bearer firebase-token",
        }),
      }),
    );
  });

  it("gives a clear error when the OAuth popup is blocked", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "open").mockReturnValue(null);
    const api = new ConnectorsApi(() => Promise.resolve("firebase-token"));

    await expect(api.connect("google-workspace")).rejects.toMatchObject({
      name: "ConnectorsApiError",
      code: "popup_blocked",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens AWS in a new tab and verifies the role without closing it", async () => {
    const overview = { providers: [], connections: [] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            setupUrl: "https://console.aws.amazon.com/cloudformation/home",
            attemptId: "attempt-aws",
            setupToken: "a".repeat(43),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "connected" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(overview), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const replace = vi.fn();
    const close = vi.fn();
    vi.spyOn(window, "open").mockReturnValue({
      opener: window,
      location: { replace },
      close,
    } as unknown as Window);
    const api = new ConnectorsApi(() => Promise.resolve("firebase-token"));

    await expect(api.connectAws("123456789012")).resolves.toEqual(overview);
    expect(replace).toHaveBeenCalledWith(
      "https://console.aws.amazon.com/cloudformation/home",
    );
    expect(close).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://backend.example/v1/connectors/aws/setup/verify",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          accountId: "123456789012",
          setupToken: "a".repeat(43),
        }),
      }),
    );
  });
});
