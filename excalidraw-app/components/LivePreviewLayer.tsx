import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import { useExcalidrawAppState } from "@excalidraw/excalidraw/components/App";

import {
  resizeLivePreview,
  type DrawsyLivePreview,
  type DrawsyLivePreviewResizeHandle,
} from "../data/LivePreview";

import "./LivePreviewLayer.scss";

type LivePreviewLayerProps = {
  previews: DrawsyLivePreview[];
  onChange: (id: string, patch: Partial<DrawsyLivePreview>) => void;
  onClose: (id: string) => void;
};

const MIN_PREVIEW_WIDTH = 360;
const MIN_PREVIEW_HEIGHT = 260;
const PREVIEW_CHROME_HEIGHT = 44;
const RESIZE_HANDLES: DrawsyLivePreviewResizeHandle[] = [
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
  "nw",
];

export const LivePreviewLayer = ({
  previews,
  onChange,
  onClose,
}: LivePreviewLayerProps) => {
  const appState = useExcalidrawAppState();
  const windowRefs = useRef(new Map<string, HTMLDivElement>());
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);

  const beginPointerAction = (
    event: ReactPointerEvent,
    preview: DrawsyLivePreview,
    action: "move" | DrawsyLivePreviewResizeHandle,
  ) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const initial = { ...preview };
    const zoom = appState.zoom.value;
    const pointerTarget = event.currentTarget as HTMLElement;
    pointerTarget.setPointerCapture?.(event.pointerId);
    setActivePreviewId(preview.id);

    const onPointerMove = (pointerEvent: PointerEvent) => {
      const deltaX = (pointerEvent.clientX - startX) / zoom;
      const deltaY = (pointerEvent.clientY - startY) / zoom;
      onChange(
        preview.id,
        action === "move"
          ? { x: initial.x + deltaX, y: initial.y + deltaY }
          : resizeLivePreview(
              initial,
              action,
              deltaX,
              deltaY,
              MIN_PREVIEW_WIDTH,
              MIN_PREVIEW_HEIGHT,
            ),
      );
    };
    const finishPointerAction = (pointerEvent: PointerEvent) => {
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", finishPointerAction, true);
      window.removeEventListener("pointercancel", finishPointerAction, true);
      if (pointerTarget.hasPointerCapture?.(pointerEvent.pointerId)) {
        pointerTarget.releasePointerCapture(pointerEvent.pointerId);
      }
      setActivePreviewId(null);
    };

    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", finishPointerAction, true);
    window.addEventListener("pointercancel", finishPointerAction, true);
  };

  const positionedPreviews = previews.map((preview) => {
    const position = sceneCoordsToViewportCoords(
      { sceneX: preview.x, sceneY: preview.y },
      appState,
    );
    const left = position.x - appState.offsetLeft;
    const top = position.y - appState.offsetTop;
    const renderedHeight = preview.collapsed
      ? PREVIEW_CHROME_HEIGHT * appState.zoom.value
      : preview.height * appState.zoom.value;
    return {
      preview,
      left,
      top,
      visible:
        left < appState.width &&
        left + preview.width * appState.zoom.value > 0 &&
        top < appState.height &&
        top + renderedHeight > 0,
    };
  });
  const hasVisiblePreview = positionedPreviews.some(({ visible }) => visible);

  return (
    <div
      className={`drawsy-live-preview-layer${
        hasVisiblePreview ? " has-visible-preview" : ""
      }`}
      aria-label="Local previews"
    >
      {positionedPreviews.map(({ preview, left, top }) => {
        return (
          <div
            key={preview.id}
            ref={(node) => {
              if (node) {
                windowRefs.current.set(preview.id, node);
              } else {
                windowRefs.current.delete(preview.id);
              }
            }}
            className={`drawsy-live-preview${
              preview.collapsed ? " is-collapsed" : ""
            }${activePreviewId === preview.id ? " is-manipulating" : ""}`}
            style={
              {
                left,
                top,
                width: preview.width,
                height: preview.collapsed ? undefined : preview.height,
                transform: `scale(${appState.zoom.value})`,
                "--drawsy-preview-edge-hit": `${12 / appState.zoom.value}px`,
                "--drawsy-preview-edge-inset": `${18 / appState.zoom.value}px`,
                "--drawsy-preview-edge-span": `${36 / appState.zoom.value}px`,
                "--drawsy-preview-edge-offset": `${-6 / appState.zoom.value}px`,
                "--drawsy-preview-corner-hit": `${24 / appState.zoom.value}px`,
                "--drawsy-preview-corner-offset": `${
                  -8 / appState.zoom.value
                }px`,
                "--drawsy-preview-grip-offset": `${9 / appState.zoom.value}px`,
                "--drawsy-preview-grip-size": `${6 / appState.zoom.value}px`,
              } as CSSProperties
            }
          >
            <div
              className="drawsy-live-preview__chrome"
              onPointerDown={(event) =>
                beginPointerAction(event, preview, "move")
              }
            >
              <div className="drawsy-live-preview__traffic-lights">
                <button
                  type="button"
                  className="drawsy-live-preview__traffic-light is-close"
                  aria-label={`Close ${preview.title}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onClose(preview.id)}
                />
                <button
                  type="button"
                  className="drawsy-live-preview__traffic-light is-minimize"
                  aria-label={
                    preview.collapsed ? "Restore preview" : "Collapse preview"
                  }
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() =>
                    onChange(preview.id, { collapsed: !preview.collapsed })
                  }
                />
                <button
                  type="button"
                  className="drawsy-live-preview__traffic-light is-fullscreen"
                  aria-label="Open preview fullscreen"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() =>
                    void windowRefs.current
                      .get(preview.id)
                      ?.requestFullscreen()
                      .catch(() => undefined)
                  }
                />
              </div>
              <div className="drawsy-live-preview__title" title={preview.url}>
                <span>{preview.title}</span>
              </div>
            </div>
            {!preview.collapsed && (
              <>
                <iframe
                  className="drawsy-live-preview__frame"
                  src={preview.url}
                  title={preview.title}
                  referrerPolicy="no-referrer"
                  sandbox="allow-forms allow-same-origin allow-scripts"
                />
                {RESIZE_HANDLES.map((handle) => (
                  <div
                    key={handle}
                    className={`drawsy-live-preview__resize is-${handle}`}
                    role="separator"
                    aria-label={`Resize ${preview.title} from ${handle}`}
                    onPointerDown={(event) =>
                      beginPointerAction(event, preview, handle)
                    }
                  />
                ))}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
