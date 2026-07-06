import { vi } from "vitest";

import { KanbanApi } from "../data/KanbanApi";

describe("KanbanApi", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_APP_DRAWSY_BACKEND_URL", "https://backend.example");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("authenticates command requests and preserves operation IDs", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            results: [
              {
                operationId: "operation-0001",
                status: "applied",
                revision: 2,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = new KanbanApi(() => Promise.resolve("firebase-token"));

    await expect(
      api.applyCommands("board-0001", "client-0001", [
        {
          operationId: "operation-0001",
          clientSequence: 1,
          knownBoardRevision: 1,
          type: "updateBoard",
          payload: { title: "Roadmap" },
        },
      ]),
    ).resolves.toEqual([
      {
        operationId: "operation-0001",
        status: "applied",
        revision: 2,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.example/v1/kanban/boards/board-0001/commands",
      expect.objectContaining({
        cache: "no-store",
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer firebase-token",
          "Cache-Control": "no-store",
        }),
      }),
    );
  });

  it("parses authenticated SSE frames without polling", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"type":"revision","latestRevision":7}\r\n\r\n',
          ),
        );
        controller.close();
      },
    });
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(stream, { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = new KanbanApi(() => Promise.resolve("firebase-token"));
    const event = new Promise<{ latestRevision?: number }>((resolve) => {
      api.connectEvents("board-0001", resolve, vi.fn());
    });

    await expect(event).resolves.toEqual({
      type: "revision",
      latestRevision: 7,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.example/v1/kanban/boards/board-0001/events",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({
          "Cache-Control": "no-cache",
        }),
      }),
    );
  });
});
