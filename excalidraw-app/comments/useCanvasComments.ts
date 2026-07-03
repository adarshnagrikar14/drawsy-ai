import { randomId } from "@excalidraw/common";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CommentsApi, CommentsApiError } from "./CommentsApi";

import type { DrawsyAuthState } from "../auth/useDrawsyAuth";
import type { CanvasComment, CommentAnchor } from "./types";

const COMMENT_SYNC_CHANNEL = "drawsy-private-comments";
const REFRESH_INTERVAL = 30_000;

const sortComments = (comments: CanvasComment[]) =>
  [...comments].sort((first, second) => second.updatedAt - first.updatedAt);

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftAnchor, setDraftAnchor] = useState<CommentAnchor | null>(null);
  const [placing, setPlacing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const refresh = useCallback(async () => {
    if (!api || !canvasId || !enabled) {
      return;
    }
    const sequence = ++requestSequence.current;
    setLoading(true);
    try {
      const result = await api.list(canvasId);
      if (sequence === requestSequence.current) {
        setComments(sortComments(result.comments));
        setError(null);
      }
    } catch (nextError) {
      if (sequence === requestSequence.current) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Comments could not load.",
        );
      }
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false);
      }
    }
  }, [api, canvasId, enabled]);

  useEffect(() => {
    requestSequence.current += 1;
    setComments([]);
    setSelectedId(null);
    setDraftAnchor(null);
    setPlacing(false);
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
      event: MessageEvent<{ canvasId?: string; userId?: string }>,
    ) => {
      if (event.data.canvasId === canvasId && event.data.userId === userId) {
        void refresh();
      }
    };
    return () => channel.close();
  }, [canvasId, enabled, refresh, userId]);

  const publishChange = useCallback(() => {
    if (typeof BroadcastChannel !== "undefined" && canvasId) {
      const channel = new BroadcastChannel(COMMENT_SYNC_CHANNEL);
      channel.postMessage({ canvasId, userId });
      channel.close();
    }
  }, [canvasId, userId]);

  const saveResult = useCallback(
    async (operation: () => Promise<{ comment: CanvasComment }>) => {
      setSaving(true);
      try {
        const result = await operation();
        setComments((current) =>
          sortComments([
            result.comment,
            ...current.filter((comment) => comment.id !== result.comment.id),
          ]),
        );
        setSelectedId(result.comment.id);
        setError(null);
        publishChange();
        return true;
      } catch (nextError) {
        if (nextError instanceof CommentsApiError && nextError.status === 409) {
          await refresh();
        }
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Comment could not save.",
        );
        return false;
      } finally {
        setSaving(false);
      }
    },
    [publishChange, refresh],
  );

  const create = useCallback(
    async (body: string) => {
      if (!api || !canvasId || !draftAnchor) {
        return false;
      }
      const saved = await saveResult(() =>
        api.create(canvasId, {
          ...draftAnchor,
          id: randomId(),
          messageId: randomId(),
          body,
        }),
      );
      if (saved) {
        setDraftAnchor(null);
      }
      return saved;
    },
    [api, canvasId, draftAnchor, saveResult],
  );

  const remove = useCallback(
    async (comment: CanvasComment) => {
      if (!api) {
        return false;
      }
      setSaving(true);
      try {
        await api.delete(comment);
        setComments((current) =>
          current.filter((item) => item.id !== comment.id),
        );
        setSelectedId((current) => (current === comment.id ? null : current));
        setError(null);
        publishChange();
        return true;
      } catch (nextError) {
        if (nextError instanceof CommentsApiError && nextError.status === 409) {
          await refresh();
        }
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Comment could not be deleted.",
        );
        return false;
      } finally {
        setSaving(false);
      }
    },
    [api, publishChange, refresh],
  );

  const selectAnchor = useCallback((anchor: CommentAnchor) => {
    setDraftAnchor(anchor);
    setPlacing(false);
  }, []);

  return {
    comments,
    selectedId,
    selected: comments.find((comment) => comment.id === selectedId) || null,
    setSelectedId,
    draftAnchor,
    setDraftAnchor,
    placing,
    setPlacing,
    selectAnchor,
    loading,
    saving,
    error,
    refresh,
    create,
    remove,
  };
};

export type CanvasCommentsController = ReturnType<typeof useCanvasComments>;
