import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCanvasComments } from "../comments/useCanvasComments";

import type { DrawsyAuthState } from "../auth/useDrawsyAuth";
import type { CanvasComment } from "../comments/types";

const list = vi.fn();
const createComment = vi.fn();
const deleteComment = vi.fn();

vi.mock("../comments/CommentsApi", () => ({
  CommentsApi: class {
    list = list;
    create = createComment;
    delete = deleteComment;
  },
  CommentsApiError: class extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

const storedComment: CanvasComment = {
  id: "comment-0001",
  canvasId: "canvas-0001",
  x: 1,
  y: 2,
  elementId: null,
  status: "open",
  version: 1,
  createdAt: 1,
  updatedAt: 1,
  messages: [
    {
      id: "message-0001",
      body: "Stored comment",
      createdAt: 1,
      updatedAt: 1,
    },
  ],
};

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const getAuth = (status: DrawsyAuthState["status"]): DrawsyAuthState => ({
  status,
  user: status === "authenticated" ? ({ uid: "user-1" } as never) : null,
  error: null,
  isBusy: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
  getIdToken: vi.fn(() => Promise.resolve("token")),
});

const renderComments = () => {
  const auth = getAuth("authenticated");
  return renderHook(() =>
    useCanvasComments({
      auth,
      canvasId: "canvas-0001",
      enabled: true,
      sidebarOpen: false,
    }),
  );
};

describe("useCanvasComments", () => {
  beforeEach(() => {
    list.mockReset();
    createComment.mockReset();
    deleteComment.mockReset();
    list.mockResolvedValue({ comments: [storedComment] });
  });

  it("removes comment state on logout without changing the canvas", async () => {
    const authenticated = getAuth("authenticated");
    const { result, rerender } = renderHook(
      ({ auth }) =>
        useCanvasComments({
          auth,
          canvasId: "canvas-0001",
          enabled: true,
          sidebarOpen: false,
        }),
      { initialProps: { auth: authenticated } },
    );

    await waitFor(() => expect(result.current.comments).toHaveLength(1));

    rerender({ auth: getAuth("anonymous") });
    await act(async () => undefined);

    expect(result.current.comments).toEqual([]);
    expect(result.current.selectedId).toBeNull();
    expect(result.current.draftAnchor).toBeNull();
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("removes comment state when the current surface is not a canvas", async () => {
    const auth = getAuth("authenticated");
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useCanvasComments({
          auth,
          canvasId: enabled ? "canvas-0001" : null,
          enabled,
          sidebarOpen: false,
        }),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => expect(result.current.comments).toHaveLength(1));

    rerender({ enabled: false });
    await act(async () => undefined);

    expect(result.current.comments).toEqual([]);
    expect(result.current.selectedId).toBeNull();
    expect(result.current.draftAnchor).toBeNull();
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("creates immediately and preserves the optimistic comment during refresh", async () => {
    list.mockResolvedValue({ comments: [] });
    const request = deferred<{ comment: CanvasComment }>();
    createComment.mockReturnValue(request.promise);
    const { result } = renderComments();
    await waitFor(() => expect(list).toHaveBeenCalled());

    act(() => result.current.selectAnchor({ x: 12, y: 24, elementId: null }));
    await act(async () => {
      await expect(result.current.create("Instant comment")).resolves.toBe(
        true,
      );
    });

    expect(result.current.comments).toHaveLength(1);
    expect(result.current.comments[0].messages[0].body).toBe("Instant comment");
    expect(result.current.draftAnchor).toBeNull();

    await act(async () => result.current.refresh());
    expect(result.current.comments).toHaveLength(1);

    const optimistic = result.current.comments[0];
    act(() => request.resolve({ comment: { ...optimistic, updatedAt: 10 } }));
    await waitFor(() => expect(result.current.comments[0].updatedAt).toBe(10));
  });

  it("does not let a stale read erase a completed optimistic create", async () => {
    list.mockResolvedValue({ comments: [] });
    const createRequest = deferred<{ comment: CanvasComment }>();
    const staleRead = deferred<{ comments: CanvasComment[] }>();
    createComment.mockReturnValue(createRequest.promise);
    const { result } = renderComments();
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.selectAnchor({ x: 12, y: 24, elementId: null }));
    await act(async () => {
      await result.current.create("Survives stale reads");
    });
    const optimistic = result.current.comments[0];

    list.mockReturnValueOnce(staleRead.promise);
    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = result.current.refresh();
    });

    act(() =>
      createRequest.resolve({
        comment: { ...optimistic, updatedAt: 10 },
      }),
    );
    await waitFor(() => expect(result.current.comments[0].updatedAt).toBe(10));

    staleRead.resolve({ comments: [] });
    await act(async () => refreshPromise);
    expect(result.current.comments).toHaveLength(1);
    expect(result.current.comments[0].updatedAt).toBe(10);
  });

  it("restores the editor and text when an optimistic create fails", async () => {
    list.mockResolvedValue({ comments: [] });
    const request = deferred<{ comment: CanvasComment }>();
    createComment.mockReturnValue(request.promise);
    const { result } = renderComments();
    await waitFor(() => expect(list).toHaveBeenCalled());

    act(() => result.current.selectAnchor({ x: 12, y: 24, elementId: null }));
    await act(async () => {
      await result.current.create("Keep this text");
    });
    expect(result.current.comments).toHaveLength(1);

    act(() => request.reject(new Error("Network unavailable")));
    await waitFor(() => expect(result.current.comments).toHaveLength(0));
    expect(result.current.draftAnchor).toEqual({
      x: 12,
      y: 24,
      elementId: null,
    });
    expect(result.current.draftBody).toBe("Keep this text");
    expect(result.current.error).toBe("Network unavailable");
  });

  it("deletes immediately and restores the comment when deletion fails", async () => {
    const request = deferred<void>();
    deleteComment.mockReturnValue(request.promise);
    const { result } = renderComments();
    await waitFor(() => expect(result.current.comments).toHaveLength(1));

    await act(async () => {
      await expect(result.current.remove(storedComment)).resolves.toBe(true);
    });
    expect(result.current.comments).toEqual([]);

    act(() => request.reject(new Error("Delete failed")));
    await waitFor(() => expect(result.current.comments).toHaveLength(1));
    expect(result.current.comments[0]).toEqual(storedComment);
    expect(result.current.error).toBe("Delete failed");
  });

  it("waits for an optimistic create before deleting the same comment", async () => {
    list.mockResolvedValue({ comments: [] });
    const createRequest = deferred<{ comment: CanvasComment }>();
    createComment.mockReturnValue(createRequest.promise);
    deleteComment.mockResolvedValue(undefined);
    const { result } = renderComments();
    await waitFor(() => expect(list).toHaveBeenCalled());

    act(() => result.current.selectAnchor({ x: 12, y: 24, elementId: null }));
    await act(async () => {
      await result.current.create("Short lived");
    });
    const optimistic = result.current.comments[0];
    await act(async () => {
      await result.current.remove(optimistic);
    });

    expect(result.current.comments).toEqual([]);
    expect(deleteComment).not.toHaveBeenCalled();

    act(() =>
      createRequest.resolve({
        comment: { ...optimistic, updatedAt: 10 },
      }),
    );
    await waitFor(() =>
      expect(deleteComment).toHaveBeenCalledWith({
        ...optimistic,
        updatedAt: 10,
      }),
    );
    expect(result.current.comments).toEqual([]);
  });
});
