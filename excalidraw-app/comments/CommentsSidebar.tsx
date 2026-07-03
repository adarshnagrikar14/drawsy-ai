import { useEffect, useMemo, useRef, useState } from "react";

import { searchIcon, TrashIcon } from "@excalidraw/excalidraw/components/icons";

import type { CanvasComment } from "./types";
import type { CanvasCommentsController } from "./useCanvasComments";

const COMMENT_DELETE_ANIMATION_MS = 180;

const relativeTime = (timestamp: number) => {
  const minutes = Math.floor(Math.max(0, Date.now() - timestamp) / 60_000);
  if (minutes < 1) {
    return "now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(timestamp).toLocaleDateString();
};

const EmptyComments = ({
  imageUrl,
  title,
  description,
  action,
  actionLabel,
  disabled = false,
  originalLayout = false,
}: {
  imageUrl: string;
  title: string;
  description: string;
  action: () => void;
  actionLabel: string;
  disabled?: boolean;
  originalLayout?: boolean;
}) => (
  <div
    className={`comments-placeholder${originalLayout ? " is-original" : ""}`}
  >
    <div
      className="comments-placeholder-image"
      style={{ ["--comments-image" as any]: `url(${imageUrl})` }}
    />
    {originalLayout ? (
      <div className="comments-placeholder-original-text">{title}</div>
    ) : (
      <>
        <h3>{title}</h3>
        <p>{description}</p>
      </>
    )}
    <button
      type="button"
      className="comments-button is-primary"
      disabled={disabled}
      onClick={action}
    >
      {actionLabel}
    </button>
  </div>
);

export const CommentsSidebar = ({
  authStatus,
  displayName,
  canvasTitle,
  isCollaborating,
  placeholderImage,
  controller,
  onSignIn,
  onStartPlacement,
  onGoToComment,
}: {
  authStatus: "loading" | "anonymous" | "authenticated";
  displayName: string;
  canvasTitle: string;
  isCollaborating: boolean;
  placeholderImage: string;
  controller: CanvasCommentsController;
  onSignIn: () => void;
  onStartPlacement: () => void;
  onGoToComment: (comment: CanvasComment) => void;
}) => {
  const [query, setQuery] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return controller.comments.filter(
      (comment) =>
        !normalized ||
        comment.messages[0]?.body.toLocaleLowerCase().includes(normalized),
    );
  }, [controller.comments, query]);

  useEffect(() => {
    if (!controller.selectedId || !selectedItemRef.current) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      selectedItemRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [controller.selectedId, filtered]);

  const removeComment = async (comment: CanvasComment) => {
    setRemovingId(comment.id);
    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!prefersReducedMotion) {
      await new Promise((resolve) =>
        window.setTimeout(resolve, COMMENT_DELETE_ANIMATION_MS),
      );
    }
    await controller.remove(comment);
    setRemovingId(null);
  };

  if (authStatus !== "authenticated") {
    return (
      <EmptyComments
        imageUrl={placeholderImage}
        title="Private comments"
        description="Sign in to place comments that only you can see."
        action={onSignIn}
        actionLabel={authStatus === "loading" ? "Checking account…" : "Sign in"}
        disabled={authStatus === "loading"}
      />
    );
  }

  if (isCollaborating) {
    return (
      <EmptyComments
        imageUrl={placeholderImage}
        title="Private comments are paused"
        description="Leave the live collaboration room to return to your private comments."
        action={() => undefined}
        actionLabel="Available after leaving"
        disabled
      />
    );
  }

  if (!controller.loading && controller.comments.length === 0) {
    return (
      <EmptyComments
        imageUrl={placeholderImage}
        title="Make comments with Drawsy+"
        description=""
        action={onStartPlacement}
        actionLabel="Place a comment"
        originalLayout
      />
    );
  }

  return (
    <div className="comments-panel">
      <div className="comments-appbar">
        <label className="comments-search">
          <span className="comments-search-icon" aria-hidden="true">
            {searchIcon}
          </span>
          <input
            type="search"
            value={query}
            placeholder="Search"
            aria-label="Search comments"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      {controller.error && (
        <div className="comments-error" role="alert">
          <span>{controller.error}</span>
          <button type="button" onClick={() => void controller.refresh()}>
            Retry
          </button>
        </div>
      )}

      <div className="comments-list" aria-busy={controller.loading}>
        {controller.loading && controller.comments.length === 0 ? (
          <div className="comments-empty">Loading comments…</div>
        ) : filtered.length === 0 ? (
          <div className="comments-empty">No matching comments</div>
        ) : (
          filtered.map((comment) => {
            const number =
              controller.comments.length -
              controller.comments.findIndex((item) => item.id === comment.id);
            return (
              <div
                key={comment.id}
                ref={
                  controller.selectedId === comment.id
                    ? selectedItemRef
                    : undefined
                }
                className={`comments-list-item ${
                  controller.selectedId === comment.id ? "is-selected" : ""
                } ${removingId === comment.id ? "is-removing" : ""}`}
              >
                <button
                  type="button"
                  className="comments-list-main"
                  onClick={() => {
                    controller.setSelectedId(comment.id);
                    onGoToComment(comment);
                  }}
                >
                  <span className="comments-number" aria-hidden="true">
                    {number}
                  </span>
                  <span className="comments-list-copy">
                    <span className="comments-list-body">
                      {comment.messages[0]?.body}
                    </span>
                    <span className="comments-list-meta">
                      <span>{canvasTitle}</span>
                      <span aria-hidden="true">·</span>
                      <span>{displayName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{relativeTime(comment.createdAt)}</span>
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="comments-delete"
                  aria-label={`Delete comment ${number}`}
                  title="Delete comment"
                  disabled={controller.saving || removingId !== null}
                  onClick={(event) => {
                    event.stopPropagation();
                    void removeComment(comment);
                  }}
                >
                  {TrashIcon}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
