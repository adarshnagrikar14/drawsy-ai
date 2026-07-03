import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import { useExcalidrawAppState } from "@excalidraw/excalidraw/components/App";
import { useEffect, useRef, useState } from "react";

import type { CommentAnchor } from "./types";

export const CommentDraftBubble = ({
  anchor,
  placing,
  number,
  initialBody,
  onCancel,
  onSave,
}: {
  anchor: CommentAnchor | null;
  placing: boolean;
  number: number;
  initialBody: string;
  onCancel: () => void;
  onSave: (body: string) => Promise<boolean>;
}) => {
  const appState = useExcalidrawAppState();
  const [body, setBody] = useState(initialBody);
  const [submitting, setSubmitting] = useState(false);
  const [pointer, setPointer] = useState({
    left: -40,
    top: -40,
    visible: false,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const position = anchor
    ? sceneCoordsToViewportCoords(
        { sceneX: anchor.x, sceneY: anchor.y },
        appState,
      )
    : null;
  const anchorLeft = position ? position.x - appState.offsetLeft : pointer.left;
  const anchorTop = position ? position.y - appState.offsetTop : pointer.top;
  const editorWidth = Math.min(224, appState.width - 24);
  const opensBelow = anchorTop < 100;
  const opensLeft = anchorLeft + editorWidth > appState.width - 12;

  useEffect(() => {
    if (!placing) {
      return;
    }
    const trackPointer = (event: PointerEvent) => {
      const left = event.clientX - appState.offsetLeft;
      const top = event.clientY - appState.offsetTop;
      setPointer({
        left,
        top,
        visible:
          left >= 0 &&
          top >= 0 &&
          left <= appState.width &&
          top <= appState.height,
      });
    };
    window.addEventListener("pointermove", trackPointer, { passive: true });
    return () => window.removeEventListener("pointermove", trackPointer);
  }, [
    appState.height,
    appState.offsetLeft,
    appState.offsetTop,
    appState.width,
    placing,
  ]);

  useEffect(() => {
    if (!anchor) {
      return;
    }
    let focusFrame = window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
    const focusAfterPlacement = () => {
      window.cancelAnimationFrame(focusFrame);
      focusFrame = window.requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    };
    window.addEventListener("pointerup", focusAfterPlacement, {
      capture: true,
      once: true,
    });
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("pointerup", focusAfterPlacement, true);
    };
  }, [anchor]);

  const save = async () => {
    const trimmed = body.trim();
    if (trimmed && !submitting) {
      setSubmitting(true);
      try {
        await onSave(trimmed);
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <div
      className={`comment-draft-bubble ${placing ? "is-cursor" : "is-editor"}${
        !placing && opensBelow ? " is-below" : ""
      }${!placing && opensLeft ? " opens-left" : ""}`}
      style={{
        left: anchorLeft,
        top: anchorTop,
        ["--comment-editor-width" as any]: `${editorWidth}px`,
        visibility: placing && !pointer.visible ? "hidden" : "visible",
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span className="comment-draft-number" aria-hidden="true">
        {number}
      </span>
      <textarea
        ref={textareaRef}
        maxLength={4000}
        rows={1}
        value={body}
        disabled={!anchor}
        tabIndex={anchor ? 0 : -1}
        aria-label="Write a private comment"
        placeholder="Write a comment…"
        onChange={(event) => {
          setBody(event.target.value);
          const textarea = event.currentTarget;
          window.requestAnimationFrame(() => {
            textarea.style.height = "auto";
            textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`;
          });
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void save();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      />
    </div>
  );
};
