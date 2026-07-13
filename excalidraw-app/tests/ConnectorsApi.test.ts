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
});
