import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommentsApi } from "../comments/CommentsApi";

const comment = {
  id: "comment-0001",
  canvasId: "canvas-0001",
  x: 10,
  y: 20,
  elementId: null,
  status: "open" as const,
  version: 3,
  createdAt: 1,
  updatedAt: 2,
  messages: [],
};

describe("CommentsApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("VITE_APP_DRAWSY_BACKEND_URL", "http://127.0.0.1:3004");
  });

  it("authenticates comment reads for only the requested canvas", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ comments: [comment] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const api = new CommentsApi(() => Promise.resolve("private-token"));

    await expect(api.list("canvas-0001")).resolves.toEqual({
      comments: [comment],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3004/v1/canvases/canvas-0001/comments",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer private-token",
        }),
      }),
    );
  });

  it("handles a successful delete without trying to parse an empty body", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    const api = new CommentsApi(() => Promise.resolve("private-token"));

    await expect(api.delete(comment)).resolves.toBeUndefined();
  });
});
