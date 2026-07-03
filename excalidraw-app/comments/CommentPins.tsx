import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import { useExcalidrawAppState } from "@excalidraw/excalidraw/components/App";

import type { CanvasComment } from "./types";

export const CommentPins = ({
  comments,
  selectedId,
  onSelect,
}: {
  comments: CanvasComment[];
  selectedId: string | null;
  onSelect: (comment: CanvasComment) => void;
}) => {
  const appState = useExcalidrawAppState();
  return (
    <div className="comment-pins-layer" aria-label="Canvas comments">
      {comments.map((comment, index) => {
        const number = comments.length - index;
        const position = sceneCoordsToViewportCoords(
          { sceneX: comment.x, sceneY: comment.y },
          appState,
        );
        const previewOnLeft =
          position.x - appState.offsetLeft > appState.width - 360;
        return (
          <button
            type="button"
            key={comment.id}
            className={`comment-pin ${
              selectedId === comment.id ? "is-selected" : ""
            } ${previewOnLeft ? "is-preview-left" : ""}`}
            style={{
              left: position.x - appState.offsetLeft,
              top: position.y - appState.offsetTop,
            }}
            aria-label={`Open comment ${number}`}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(comment);
            }}
          >
            <span className="comment-pin-number" aria-hidden="true">
              {number}
            </span>
            <span className="comment-pin-text">
              {comment.messages[0]?.body}
            </span>
          </button>
        );
      })}
    </div>
  );
};
