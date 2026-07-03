import { randomId } from "@excalidraw/common";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CommentsApi, CommentsApiError } from "./CommentsApi";

import type { DrawsyAuthState } from "../auth/useDrawsyAuth";
import type { CanvasComment, CommentAnchor } from "./types";
import type { SetStateAction } from "react";

const COMMENT_SYNC_CHANNEL = "drawsy-private-comments";
const COMMENT_CLIENT_ID = randomId();
const REFRESH_INTERVAL = 30_000;

const sortComments = (comments: CanvasComment[]) =>
  [...comments].sort((first, second) => second.updatedAt - first.updatedAt);

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

type PendingDelete = {
  comment: CanvasComment;
  wasSelected: boolean;
};

export const useCanvasComments = ({
  auth,
  canvasId,
  enabled,
  sidebarOpen,
}: {
  auth: DrawsyAuthState;
  canvasId: string | null;
  enabled: boolean;
  sidebarOpen: boolean;
}) => {
  const userId = auth.user?.uid || null;
  const api = useMemo(
    () =>
      auth.status === "authenticated" && userId
        ? new CommentsApi(auth.getIdToken)
        : null,
    [auth.getIdToken, auth.status, userId],
  );
  const [comments, setComments] = useState<CanvasComment[]>([]);
  const [selectedId, setSelectedIdState] = useState<string | null>(null);
  const [draftAnchor, setDraftAnchorState] = useState<CommentAnchor | null>(
    null,
  );
  const [draftBody, setDraftBody] = useState("");
  const [placing, setPlacingState] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const scopeGeneration = useRef(0);
  const interactionRevision = useRef(0);
  const draftAnchorRef = useRef<CommentAnchor | null>(null);
  const placingRef = useRef(false);
  const pendingCreates = useRef(new Map<string, CanvasComment>());
  const pendingCreateRequests = useRef(
    new Map<string, Promise<CanvasComment>>(),
  );
  const pendingDeletes = useRef(new Map<string, PendingDelete>());

  const invalidateReads = useCallback(() => {
    requestSequence.current += 1;
    setLoading(false);
  }, []);

  const setSelectedId = useCallback((next: SetStateAction<string | null>) => {
    interactionRevision.current += 1;
    setSelectedIdState(next);
  }, []);

  const setDraftAnchor = useCallback(
    (next: SetStateAction<CommentAnchor | null>) => {
      const value =
        typeof next === "function" ? next(draftAnchorRef.current) : next;
      interactionRevision.current += 1;
      draftAnchorRef.current = value;
      setDraftAnchorState(value);
      if (!value) {
        setDraftBody("");
      }
    },
    [],
  );

  const setPlacing = useCallback((next: SetStateAction<boolean>) => {
    const value = typeof next === "function" ? next(placingRef.current) : next;
    interactionRevision.current += 1;
    placingRef.current = value;
    setPlacingState(value);
  }, []);

  const reconcilePending = useCallback((serverComments: CanvasComment[]) => {
    const deletedIds = pendingDeletes.current;
    const serverIds = new Set(serverComments.map((comment) => comment.id));
    const reconciled = serverComments.filter(
      (comment) => !deletedIds.has(comment.id),
    );
    for (const comment of pendingCreates.current.values()) {
      if (!serverIds.has(comment.id) && !deletedIds.has(comment.id)) {
        reconciled.push(comment);
      }
    }
    return sortComments(reconciled);
  }, []);

  const refresh = useCallback(async () => {
    if (!api || !canvasId || !enabled) {
      return;
    }
    const sequence = ++requestSequence.current;
    setLoading(true);
    try {
      const result = await api.list(canvasId);
      if (sequence === requestSequence.current) {
        setComments(reconcilePending(result.comments));
        setError(null);
      }
    } catch (nextError) {
      if (sequence === requestSequence.current) {
        setError(errorMessage(nextError, "Comments could not load."));
      }
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false);
      }
    }
  }, [api, canvasId, enabled, reconcilePending]);

  useEffect(() => {
    scopeGeneration.current += 1;
    requestSequence.current += 1;
    interactionRevision.current += 1;
    pendingCreates.current.clear();
    pendingCreateRequests.current.clear();
    pendingDeletes.current.clear();
    draftAnchorRef.current = null;
    placingRef.current = false;
    setComments([]);
    setSelectedIdState(null);
    setDraftAnchorState(null);
    setDraftBody("");
    setPlacingState(false);
    setError(null);
    if (api && canvasId && enabled) {
      void refresh();
    }
  }, [api, canvasId, enabled, refresh]);

  useEffect(() => {
    if (!sidebarOpen || !api || !canvasId || !enabled) {
      return;
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, REFRESH_INTERVAL);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [api, canvasId, enabled, refresh, sidebarOpen]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined" || !canvasId || !enabled) {
      return;
    }
    const channel = new BroadcastChannel(COMMENT_SYNC_CHANNEL);
    channel.onmessage = (
      event: MessageEvent<{
        canvasId?: string;
        userId?: string;
        sourceId?: string;
      }>,
    ) => {
      if (
        event.data.sourceId !== COMMENT_CLIENT_ID &&
        event.data.canvasId === canvasId &&
        event.data.userId === userId
      ) {
        void refresh();
      }
    };
    return () => channel.close();
  }, [canvasId, enabled, refresh, userId]);

  const publishChange = useCallback(() => {
    if (typeof BroadcastChannel !== "undefined" && canvasId) {
      const channel = new BroadcastChannel(COMMENT_SYNC_CHANNEL);
      channel.postMessage({
        canvasId,
        userId,
        sourceId: COMMENT_CLIENT_ID,
      });
      channel.close();
    }
  }, [canvasId, userId]);

  const create = useCallback(
    async (body: string) => {
      const anchor = draftAnchorRef.current;
      if (!api || !canvasId || !anchor) {
        return false;
      }

      const id = randomId();
      const messageId = randomId();
      const now = Date.now();
      const generation = scopeGeneration.current;
      const recoveryRevision = interactionRevision.current;
      const optimisticComment: CanvasComment = {
        id,
        canvasId,
        ...anchor,
        status: "open",
        version: 1,
        createdAt: now,
        updatedAt: now,
        messages: [{ id: messageId, body, createdAt: now, updatedAt: now }],
      };

      pendingCreates.current.set(id, optimisticComment);
      invalidateReads();
      setComments((current) => sortComments([optimisticComment, ...current]));
      setSelectedIdState(id);
      draftAnchorRef.current = null;
      setDraftAnchorState(null);
      setDraftBody("");
      setError(null);

      const request = api
        .create(canvasId, { ...anchor, id, messageId, body })
        .then((result) => result.comment);
      pendingCreateRequests.current.set(id, request);

      void request.then(
        (serverComment) => {
          if (generation !== scopeGeneration.current) {
            return;
          }
          pendingCreates.current.delete(id);
          pendingCreateRequests.current.delete(id);
          if (!pendingDeletes.current.has(id)) {
            invalidateReads();
            setComments((current) =>
              sortComments([
                serverComment,
                ...current.filter((comment) => comment.id !== id),
              ]),
            );
            setError(null);
            publishChange();
          }
        },
        (nextError) => {
          if (generation !== scopeGeneration.current) {
            return;
          }
          pendingCreates.current.delete(id);
          pendingCreateRequests.current.delete(id);
          if (pendingDeletes.current.has(id)) {
            return;
          }
          setComments((current) =>
            current.filter((comment) => comment.id !== id),
          );
          setSelectedIdState((current) => (current === id ? null : current));
          if (
            recoveryRevision === interactionRevision.current &&
            !placingRef.current &&
            !draftAnchorRef.current
          ) {
            draftAnchorRef.current = anchor;
            setDraftAnchorState(anchor);
            setDraftBody(body);
          }
          setError(errorMessage(nextError, "Comment could not save."));
        },
      );

      return true;
    },
    [api, canvasId, invalidateReads, publishChange],
  );

  const remove = useCallback(
    async (comment: CanvasComment) => {
      if (!api || pendingDeletes.current.has(comment.id)) {
        return false;
      }

      const generation = scopeGeneration.current;
      const pendingCreate = pendingCreateRequests.current.get(comment.id);
      pendingDeletes.current.set(comment.id, {
        comment,
        wasSelected: selectedId === comment.id,
      });
      invalidateReads();
      setComments((current) =>
        current.filter((item) => item.id !== comment.id),
      );
      setSelectedIdState((current) =>
        current === comment.id ? null : current,
      );
      setError(null);

      void (async () => {
        let serverComment = comment;
        if (pendingCreate) {
          try {
            serverComment = await pendingCreate;
            if (generation === scopeGeneration.current) {
              const pending = pendingDeletes.current.get(comment.id);
              if (pending) {
                pendingDeletes.current.set(comment.id, {
                  ...pending,
                  comment: serverComment,
                });
              }
            }
          } catch {
            if (generation === scopeGeneration.current) {
              pendingDeletes.current.delete(comment.id);
            }
            return;
          }
        }

        try {
          await api.delete(serverComment);
          if (generation !== scopeGeneration.current) {
            return;
          }
          invalidateReads();
          pendingDeletes.current.delete(comment.id);
          setError(null);
          publishChange();
        } catch (nextError) {
          if (generation !== scopeGeneration.current) {
            return;
          }
          const pending = pendingDeletes.current.get(comment.id);
          pendingDeletes.current.delete(comment.id);
          if (
            nextError instanceof CommentsApiError &&
            nextError.status === 404 &&
            nextError.code === "comment_not_found"
          ) {
            invalidateReads();
            publishChange();
            return;
          }
          if (
            nextError instanceof CommentsApiError &&
            nextError.status === 409
          ) {
            await refresh();
          } else if (pending) {
            setComments((current) =>
              sortComments([
                pending.comment,
                ...current.filter((item) => item.id !== comment.id),
              ]),
            );
            if (pending.wasSelected) {
              setSelectedIdState((current) => current || comment.id);
            }
          }
          setError(errorMessage(nextError, "Comment could not be deleted."));
        }
      })();

      return true;
    },
    [api, invalidateReads, publishChange, refresh, selectedId],
  );

  const selectAnchor = useCallback((anchor: CommentAnchor) => {
    interactionRevision.current += 1;
    draftAnchorRef.current = anchor;
    placingRef.current = false;
    setDraftAnchorState(anchor);
    setDraftBody("");
    setPlacingState(false);
  }, []);

  return {
    comments,
    selectedId,
    selected: comments.find((comment) => comment.id === selectedId) || null,
    setSelectedId,
    draftAnchor,
    draftBody,
    setDraftAnchor,
    placing,
    setPlacing,
    selectAnchor,
    loading,
    error,
    refresh,
    create,
    remove,
  };
};

export type CanvasCommentsController = ReturnType<typeof useCanvasComments>;
