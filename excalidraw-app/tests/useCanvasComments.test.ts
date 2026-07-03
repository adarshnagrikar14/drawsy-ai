import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCanvasComments } from "../comments/useCanvasComments";

import type { DrawsyAuthState } from "../auth/useDrawsyAuth";

const list = vi.fn();

vi.mock("../comments/CommentsApi", () => ({
  CommentsApi: class {
    list = list;
  },
  CommentsApiError: class extends Error {},
}));

const getAuth = (status: DrawsyAuthState["status"]): DrawsyAuthState => ({
  status,
  user: status === "authenticated" ? ({ uid: "user-1" } as never) : null,
  error: null,
  isBusy: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
  getIdToken: vi.fn(() => Promise.resolve("token")),
});

describe("useCanvasComments", () => {
  beforeEach(() => {
    list.mockReset();
    list.mockResolvedValue({
      comments: [
        {
          id: "comment-0001",
          canvasId: "canvas-0001",
          x: 1,
          y: 2,
          elementId: null,
          status: "open",
          version: 1,
          createdAt: 1,
          updatedAt: 1,
          messages: [],
        },
      ],
    });
  });

  it("removes comment state on logout without changing the canvas", async () => {
    const { result, rerender } = renderHook(
      ({ auth }) =>
        useCanvasComments({
          auth,
          canvasId: "canvas-0001",
          enabled: true,
          sidebarOpen: false,
        }),
      { initialProps: { auth: getAuth("authenticated") } },
    );

    await waitFor(() => expect(result.current.comments).toHaveLength(1));

    rerender({ auth: getAuth("anonymous") });
    await act(async () => undefined);

    expect(result.current.comments).toEqual([]);
    expect(result.current.selectedId).toBeNull();
    expect(result.current.draftAnchor).toBeNull();
    expect(list).toHaveBeenCalledTimes(1);
  });
});
