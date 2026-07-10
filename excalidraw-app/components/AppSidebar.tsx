import {
  DefaultSidebar,
  Sidebar,
  THEME,
  exportToCanvas,
} from "@excalidraw/excalidraw";
import {
  MagicIcon,
  extraToolsIcon,
  frameToolIcon,
  ImageIcon,
  LoadIcon,
  messageCircleIcon,
  palette,
  presentationIcon,
  PlusIcon,
  start,
  TrashIcon,
  ArrowRightIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import {
  getFrameChildren,
  getNonDeletedElements,
  getSelectedElements,
  isFrameLikeElement,
} from "@excalidraw/element";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawFrameLikeElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";

import { CommentsSidebar } from "../comments/CommentsSidebar";
import {
  getPresentationBuilds,
  type PresentationAnimationMetadata,
  type PresentationBuild,
  type PresentationBuildDirection,
  type PresentationBuildEffect,
  type PresentationBuildTrigger,
  type PresentationSlideTransition,
} from "../presentation/animations";

import "./AppSidebar.scss";

import type { CanvasComment } from "../comments/types";
import type { CanvasCommentsController } from "../comments/useCanvasComments";

type PresentationPanelTab =
  | "slides"
  | "templates"
  | "animation"
  | "resources"
  | "layout";

export type PresentationLayout =
  | "horizontal"
  | "vertical"
  | "grid"
  | "freeform";
export type PresentationTemplateId =
  | "intro-orbit"
  | "intro-blocks"
  | "intro-claim"
  | "intro-signal"
  | "outro-closing"
  | "outro-next"
  | "outro-qa"
  | "outro-contact"
  | "content-beats"
  | "content-data"
  | "content-flow"
  | "content-compare";
export type PresentationResourceId =
  | "bar-chart"
  | "line-chart"
  | "donut-chart"
  | "area-chart"
  | "process"
  | "funnel"
  | "timeline"
  | "matrix"
  | "kpi-cards"
  | "comparison-table"
  | "roadmap"
  | "pricing-grid";
export type PresentationResourceConfig = {
  resourceId: PresentationResourceId;
  title: string;
  rows: { id: string; label: string; value: string }[];
  style: "clean" | "colorful" | "executive";
};
type PresentationExportAppState = Partial<
  Omit<AppState, "offsetTop" | "offsetLeft">
>;

const PRESENTATION_TABS: {
  id: PresentationPanelTab;
  label: string;
  icon: ReactNode;
}[] = [
  { id: "slides", label: "Slides", icon: frameToolIcon },
  { id: "templates", label: "Templates", icon: palette },
  { id: "animation", label: "Animation", icon: MagicIcon },
  { id: "resources", label: "Resources", icon: ImageIcon },
  { id: "layout", label: "Layout", icon: extraToolsIcon },
];

const PRESENTATION_BUILD_EFFECTS: {
  value: PresentationBuildEffect;
  label: string;
}[] = [
  { value: "appear", label: "Appear" },
  { value: "fade", label: "Fade" },
  { value: "fly", label: "Fly in" },
];

const PRESENTATION_BUILD_TRIGGERS: {
  value: PresentationBuildTrigger;
  label: string;
}[] = [
  { value: "on-click", label: "On click" },
  { value: "with-previous", label: "With previous" },
  { value: "after-previous", label: "After previous" },
];

const PRESENTATION_BUILD_DIRECTIONS: {
  value: PresentationBuildDirection;
  label: string;
}[] = [
  { value: "left", label: "From left" },
  { value: "right", label: "From right" },
  { value: "up", label: "From top" },
  { value: "down", label: "From bottom" },
];

const PRESENTATION_TEMPLATE_SECTIONS: {
  title: string;
  items: {
    id: PresentationTemplateId;
    label: string;
    tone: string;
  }[];
}[] = [
  {
    title: "Intro templates",
    items: [
      { id: "intro-orbit", label: "Orbit launch", tone: "violet" },
      { id: "intro-blocks", label: "Color blocks", tone: "coral" },
      { id: "intro-claim", label: "Big claim", tone: "blue" },
      { id: "intro-signal", label: "Signal line", tone: "green" },
    ],
  },
  {
    title: "Outro templates",
    items: [
      { id: "outro-closing", label: "Closing note", tone: "blue" },
      { id: "outro-next", label: "Next steps", tone: "green" },
      { id: "outro-qa", label: "Q and A", tone: "violet" },
      { id: "outro-contact", label: "Contact card", tone: "coral" },
    ],
  },
  {
    title: "Content templates",
    items: [
      { id: "content-beats", label: "Three beats", tone: "green" },
      { id: "content-data", label: "Data story", tone: "blue" },
      { id: "content-flow", label: "Process flow", tone: "coral" },
      { id: "content-compare", label: "Compare", tone: "violet" },
    ],
  },
];

const PRESENTATION_RESOURCE_SECTIONS: {
  title: string;
  items: {
    id: PresentationResourceId;
    label: string;
    type: string;
    tone: string;
    rows: { label: string; value: string }[];
  }[];
}[] = [
  {
    title: "Charts",
    items: [
      {
        id: "bar-chart",
        label: "Bar chart",
        type: "editable data",
        tone: "blue",
        rows: [
          { label: "Q1", value: "42" },
          { label: "Q2", value: "68" },
          { label: "Q3", value: "55" },
          { label: "Q4", value: "86" },
        ],
      },
      {
        id: "line-chart",
        label: "Line chart",
        type: "editable trend",
        tone: "green",
        rows: [
          { label: "Jan", value: "18" },
          { label: "Feb", value: "36" },
          { label: "Mar", value: "29" },
          { label: "Apr", value: "64" },
          { label: "May", value: "78" },
        ],
      },
      {
        id: "donut-chart",
        label: "Donut chart",
        type: "editable split",
        tone: "coral",
        rows: [
          { label: "Organic", value: "45" },
          { label: "Paid", value: "28" },
          { label: "Referral", value: "17" },
          { label: "Direct", value: "10" },
        ],
      },
      {
        id: "area-chart",
        label: "Area chart",
        type: "adoption curve",
        tone: "violet",
        rows: [
          { label: "Week 1", value: "12" },
          { label: "Week 2", value: "28" },
          { label: "Week 3", value: "54" },
          { label: "Week 4", value: "82" },
        ],
      },
    ],
  },
  {
    title: "Diagrams",
    items: [
      {
        id: "process",
        label: "3-step process",
        type: "sequence",
        tone: "blue",
        rows: [
          { label: "Capture", value: "Collect the signal" },
          { label: "Shape", value: "Turn it into structure" },
          { label: "Present", value: "Guide the room" },
        ],
      },
      {
        id: "funnel",
        label: "Funnel",
        type: "conversion path",
        tone: "coral",
        rows: [
          { label: "Awareness", value: "12k" },
          { label: "Interest", value: "6.4k" },
          { label: "Intent", value: "2.1k" },
          { label: "Action", value: "840" },
        ],
      },
      {
        id: "timeline",
        label: "Timeline",
        type: "milestones",
        tone: "green",
        rows: [
          { label: "Discover", value: "Week 1" },
          { label: "Design", value: "Week 2" },
          { label: "Launch", value: "Week 4" },
        ],
      },
      {
        id: "matrix",
        label: "2x2 matrix",
        type: "decision map",
        tone: "violet",
        rows: [
          { label: "Now", value: "High impact" },
          { label: "Next", value: "Low effort" },
          { label: "Later", value: "Strategic" },
          { label: "Avoid", value: "Low signal" },
        ],
      },
    ],
  },
  {
    title: "Business blocks",
    items: [
      {
        id: "kpi-cards",
        label: "KPI cards",
        type: "metrics",
        tone: "violet",
        rows: [
          { label: "Revenue", value: "$84k" },
          { label: "Growth", value: "+32%" },
          { label: "Users", value: "12.8k" },
        ],
      },
      {
        id: "comparison-table",
        label: "Comparison table",
        type: "side-by-side",
        tone: "blue",
        rows: [
          { label: "Speed", value: "Fast / Faster" },
          { label: "Effort", value: "Medium / Low" },
          { label: "Risk", value: "Known / Lower" },
        ],
      },
      {
        id: "roadmap",
        label: "Roadmap strip",
        type: "quarters",
        tone: "green",
        rows: [
          { label: "Q1", value: "Foundation" },
          { label: "Q2", value: "Launch" },
          { label: "Q3", value: "Scale" },
          { label: "Q4", value: "Optimize" },
        ],
      },
      {
        id: "pricing-grid",
        label: "Pricing grid",
        type: "plans",
        tone: "coral",
        rows: [
          { label: "Starter", value: "$19" },
          { label: "Pro", value: "$49" },
          { label: "Team", value: "$99" },
        ],
      },
    ],
  },
];

const resourceRowId = () =>
  `resource-row-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

const getPresentationResource = (resourceId: PresentationResourceId) =>
  PRESENTATION_RESOURCE_SECTIONS.flatMap((section) => section.items).find(
    (item) => item.id === resourceId,
  );

const createPresentationResourceConfig = (
  resourceId: PresentationResourceId,
): PresentationResourceConfig => {
  const resource = getPresentationResource(resourceId);

  return {
    resourceId,
    title: resource?.label || "Resource",
    rows:
      resource?.rows.map((row) => ({
        ...row,
        id: resourceRowId(),
      })) || [],
    style: "colorful",
  };
};

const parseResourceRows = (content: string) =>
  content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label = "", value = ""] = line.includes("\t")
        ? line.split("\t")
        : line.split(",");

      return {
        id: resourceRowId(),
        label: label.trim(),
        value: value.trim(),
      };
    })
    .filter((row) => row.label || row.value);

const sortFramesForSlides = (frames: readonly ExcalidrawFrameLikeElement[]) => {
  return [...frames].sort((a, b) => {
    const rowTolerance = Math.max(80, Math.min(a.height, b.height) * 0.2);
    if (Math.abs(a.y - b.y) > rowTolerance) {
      return a.y - b.y;
    }
    return a.x - b.x;
  });
};

const PresentationSlideThumbnail = ({
  index,
  frame,
  elements,
  appState,
  files,
}: {
  index: number;
  frame: ExcalidrawFrameLikeElement;
  elements: readonly OrderedExcalidrawElement[];
  appState: PresentationExportAppState;
  files: BinaryFiles;
}) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    exportToCanvas({
      elements: getNonDeletedElements(elements),
      appState: {
        ...appState,
        exportBackground: true,
        exportScale: 1,
      },
      files,
      maxWidthOrHeight: 220,
      exportPadding: 0,
      exportingFrame: frame,
    })
      .then((canvas) => {
        if (!cancelled) {
          setThumbnailUrl(canvas.toDataURL("image/png"));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setThumbnailUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appState, elements, files, frame]);

  return (
    <div className="presentation-slide-card__preview">
      {thumbnailUrl ? (
        <img alt="" src={thumbnailUrl} />
      ) : (
        <span>{index + 1}</span>
      )}
    </div>
  );
};

const PresentationPanel = ({
  elements,
  appState,
  files,
  onFocusSlide,
  onStartPresentation,
  onLayoutChange,
  onTemplateInsert,
  onResourceInsert,
  onRenameSlide,
  onDeleteSlide,
  onReorderSlide,
  animationMetadata,
  onPresentationBuildAdd,
  onPresentationBuildDelete,
  onPresentationSlideTransitionChange,
}: {
  elements: readonly OrderedExcalidrawElement[];
  appState: PresentationExportAppState;
  files: BinaryFiles;
  onFocusSlide: (frameId: string) => void;
  onStartPresentation: () => void;
  onLayoutChange: (layout: PresentationLayout) => void;
  onTemplateInsert: (
    templateId: PresentationTemplateId,
    layout: PresentationLayout,
  ) => void;
  onResourceInsert: (
    config: PresentationResourceConfig,
    layout: PresentationLayout,
  ) => void;
  onRenameSlide: (frameId: string, name: string) => void;
  onDeleteSlide: (frameId: string, layout: PresentationLayout) => void;
  onReorderSlide: (
    frameId: string,
    targetFrameId: string,
    layout: PresentationLayout,
  ) => void;
  animationMetadata: PresentationAnimationMetadata;
  onPresentationBuildAdd: (build: Omit<PresentationBuild, "id">) => void;
  onPresentationBuildDelete: (buildId: string) => void;
  onPresentationSlideTransitionChange: (
    frameId: string,
    transition: PresentationSlideTransition,
  ) => void;
}) => {
  const [activeTab, setActiveTab] = useState<PresentationPanelTab>("slides");
  const [activeLayout, setActiveLayout] =
    useState<PresentationLayout>("freeform");
  const [editingFrameId, setEditingFrameId] = useState<string | null>(null);
  const [editingSlideName, setEditingSlideName] = useState("");
  const [draggedFrameId, setDraggedFrameId] = useState<string | null>(null);
  const [dropFrameId, setDropFrameId] = useState<string | null>(null);
  const [resourceConfig, setResourceConfig] =
    useState<PresentationResourceConfig | null>(null);
  const [animationEffect, setAnimationEffect] =
    useState<PresentationBuildEffect>("fade");
  const [animationTrigger, setAnimationTrigger] =
    useState<PresentationBuildTrigger>("on-click");
  const [animationDirection, setAnimationDirection] =
    useState<PresentationBuildDirection>("left");
  const resourceImportInputRef = useRef<HTMLInputElement | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    x: number;
    y: number;
    title: string;
    meta: string;
  } | null>(null);

  useEffect(() => {
    if (!draggedFrameId) {
      return;
    }

    const clearDragState = () => {
      setDraggedFrameId(null);
      setDropFrameId(null);
      setDragPreview(null);
    };
    const updateDragPreview = (event: PointerEvent) => {
      setDragPreview((currentPreview) =>
        currentPreview
          ? { ...currentPreview, x: event.clientX, y: event.clientY }
          : null,
      );
    };

    window.addEventListener("pointermove", updateDragPreview);
    window.addEventListener("pointerup", clearDragState);
    window.addEventListener("blur", clearDragState);

    return () => {
      window.removeEventListener("pointermove", updateDragPreview);
      window.removeEventListener("pointerup", clearDragState);
      window.removeEventListener("blur", clearDragState);
    };
  }, [draggedFrameId]);

  const { frames, childCountByFrameId } = useMemo(() => {
    const nonDeletedElements = getNonDeletedElements(elements);
    const frames = sortFramesForSlides(
      nonDeletedElements.filter(
        isFrameLikeElement,
      ) as ExcalidrawFrameLikeElement[],
    );
    const childCountByFrameId = new Map<string, number>();

    for (const frame of frames) {
      childCountByFrameId.set(
        frame.id,
        getFrameChildren(nonDeletedElements, frame.id).length,
      );
    }

    return { frames, childCountByFrameId };
  }, [elements]);

  const renderSlides = () => {
    if (!frames.length) {
      return (
        <div className="presentation-panel-empty">
          <div className="presentation-panel-empty__art" aria-hidden="true">
            <div />
            <span />
          </div>
          <div className="presentation-panel-empty__title">
            No slide frames yet
          </div>
          <p>
            Draw normally. When something should become a slide, put a frame
            around it.
          </p>
        </div>
      );
    }

    return (
      <div className="presentation-slide-list">
        <div className="presentation-panel-section-heading">
          <span>
            {frames.length} {frames.length === 1 ? "Slide" : "Slides"}
          </span>
        </div>
        {frames.map((frame, index) => {
          const title = frame.name?.trim() || `Slide ${index + 1}`;
          const childCount = childCountByFrameId.get(frame.id) || 0;
          const isEditing = editingFrameId === frame.id;
          const finishRename = () => {
            const nextName = editingSlideName.trim();
            setEditingFrameId(null);

            if (nextName && nextName !== title) {
              onRenameSlide(frame.id, nextName);
            }
          };

          return (
            <article
              className={`presentation-slide-card${
                dropFrameId === frame.id && draggedFrameId !== frame.id
                  ? " is-drop-target"
                  : ""
              }${draggedFrameId === frame.id ? " is-being-dragged" : ""}`}
              key={frame.id}
              onPointerEnter={() => {
                if (!draggedFrameId || draggedFrameId === frame.id) {
                  return;
                }

                setDropFrameId(frame.id);
                onReorderSlide(draggedFrameId, frame.id, activeLayout);
              }}
            >
              <div
                role="button"
                tabIndex={0}
                className="presentation-slide-card__main"
                onClick={() => onFocusSlide(frame.id)}
                onKeyDown={(event) => {
                  if (
                    event.target instanceof HTMLInputElement ||
                    event.target instanceof HTMLButtonElement
                  ) {
                    return;
                  }

                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onFocusSlide(frame.id);
                  }
                }}
              >
                <PresentationSlideThumbnail
                  index={index}
                  frame={frame}
                  elements={elements}
                  appState={appState}
                  files={files}
                />
                <div className="presentation-slide-card__body">
                  {isEditing ? (
                    <input
                      aria-label={`Rename ${title}`}
                      autoFocus
                      className="presentation-slide-card__name-input"
                      value={editingSlideName}
                      onBlur={finishRename}
                      onChange={(event) =>
                        setEditingSlideName(event.target.value)
                      }
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => {
                        event.stopPropagation();

                        if (event.key === "Enter") {
                          event.preventDefault();
                          finishRename();
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          setEditingFrameId(null);
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="presentation-slide-card__title-button"
                      title="Rename"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditingFrameId(frame.id);
                        setEditingSlideName(title);
                      }}
                    >
                      {title}
                    </button>
                  )}
                  <span>
                    {Math.round(frame.width)} x {Math.round(frame.height)} ·{" "}
                    {childCount} {childCount === 1 ? "item" : "items"}
                  </span>
                </div>
              </div>
              <div className="presentation-slide-card__actions">
                <button
                  type="button"
                  aria-label={`Delete ${title}`}
                  className="presentation-slide-card__action--danger"
                  title="Delete"
                  onClick={() => onDeleteSlide(frame.id, activeLayout)}
                >
                  {TrashIcon}
                </button>
                <button
                  type="button"
                  aria-label={`Drag ${title} to reorder`}
                  className="presentation-slide-card__drag-handle"
                  title="Drag to reorder"
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setDraggedFrameId(frame.id);
                    setDropFrameId(null);
                    setDragPreview({
                      x: event.clientX,
                      y: event.clientY,
                      title,
                      meta: `${Math.round(frame.width)} x ${Math.round(
                        frame.height,
                      )} · ${childCount} ${
                        childCount === 1 ? "item" : "items"
                      }`,
                    });
                  }}
                >
                  <span aria-hidden="true" />
                </button>
              </div>
            </article>
          );
        })}
        {dragPreview
          ? createPortal(
              <div
                className="presentation-slide-drag-preview"
                style={{
                  transform: `translate3d(${dragPreview.x + 12}px, ${
                    dragPreview.y + 12
                  }px, 0)`,
                }}
              >
                <span className="presentation-slide-drag-preview__thumb" />
                <div>
                  <strong>{dragPreview.title}</strong>
                  <span>{dragPreview.meta}</span>
                </div>
              </div>,
              document.body,
            )
          : null}
      </div>
    );
  };

  const renderTemplates = () => (
    <div className="presentation-template-sections">
      {PRESENTATION_TEMPLATE_SECTIONS.map((section) => (
        <section className="presentation-template-section" key={section.title}>
          <div className="presentation-panel-section-heading">
            <span>{section.title}</span>
          </div>
          <div className="presentation-card-grid">
            {section.items.map((item) => (
              <button
                type="button"
                className="presentation-template-card"
                data-template={item.id}
                data-tone={item.tone}
                key={item.id}
                onClick={() => onTemplateInsert(item.id, activeLayout)}
              >
                <span
                  className="presentation-template-card__thumbnail"
                  aria-hidden="true"
                >
                  <i />
                  <b />
                  <em />
                  <small />
                </span>
                <strong>{item.label}</strong>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );

  const renderAnimation = () => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      { selectedElementIds: appState.selectedElementIds || {} },
      { includeBoundTextElement: true },
    );
    const selectedFrame =
      selectedElements.length === 1 && isFrameLikeElement(selectedElements[0])
        ? selectedElements[0]
        : null;
    const selectedObjects = selectedElements.filter(
      (element) => !isFrameLikeElement(element),
    );
    const selectedFrameIds = new Set(
      selectedObjects
        .map((element) => element.frameId)
        .filter((frameId): frameId is string => !!frameId),
    );
    const selectedFrameId =
      selectedFrame || selectedFrameIds.size !== 1
        ? null
        : [...selectedFrameIds][0];
    const canCreateBuild =
      selectedObjects.length > 0 &&
      !selectedFrame &&
      selectedFrameIds.size === 1 &&
      !!selectedFrameId;
    const activeFrameId = selectedFrame?.id || selectedFrameId;
    const builds = activeFrameId
      ? getPresentationBuilds(animationMetadata, activeFrameId)
      : [];
    const builtTargetIds = new Set(builds.flatMap((build) => build.targetIds));
    const selectionAlreadyHasBuild = selectedObjects.some((element) =>
      builtTargetIds.has(element.id),
    );
    const activeFrame = activeFrameId
      ? frames.find((frame) => frame.id === activeFrameId)
      : null;
    const activeSlideTitle = activeFrame
      ? activeFrame.name?.trim() || `Slide ${frames.indexOf(activeFrame) + 1}`
      : null;

    return (
      <div className="presentation-animation">
        {selectedFrame ? (
          <section className="presentation-animation__section presentation-animation__transition">
            <div className="presentation-animation__heading">
              <span>Slide entry</span>
              <strong>{activeSlideTitle}</strong>
            </div>
            <div className="presentation-animation__segmented">
              {(
                [
                  ["none", "None"],
                  ["fade", "Fade"],
                ] as const
              ).map(([transition, label]) => (
                <button
                  type="button"
                  data-active={
                    (animationMetadata.transitions[selectedFrame.id] ||
                      "none") === transition
                  }
                  key={transition}
                  onClick={() =>
                    onPresentationSlideTransitionChange(
                      selectedFrame.id,
                      transition,
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        ) : canCreateBuild ? (
          <section className="presentation-animation__section presentation-animation__composer">
            <div className="presentation-animation__heading">
              <span>Selection</span>
              <strong>
                {selectedObjects.length}{" "}
                {selectedObjects.length === 1 ? "object" : "objects"}
              </strong>
            </div>
            <div className="presentation-animation__control-group">
              <span>Build in</span>
              <div className="presentation-animation__segmented">
                {PRESENTATION_BUILD_EFFECTS.map((effect) => (
                  <button
                    type="button"
                    data-active={animationEffect === effect.value}
                    key={effect.value}
                    onClick={() => setAnimationEffect(effect.value)}
                  >
                    {effect.label}
                  </button>
                ))}
              </div>
            </div>
            {animationEffect === "fly" && (
              <div className="presentation-animation__control-group">
                <span>Direction</span>
                <div className="presentation-animation__direction-grid">
                  {PRESENTATION_BUILD_DIRECTIONS.map((direction) => (
                    <button
                      type="button"
                      data-active={animationDirection === direction.value}
                      key={direction.value}
                      onClick={() => setAnimationDirection(direction.value)}
                    >
                      {direction.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="presentation-animation__control-group">
              <span>Start</span>
              <div className="presentation-animation__trigger-grid">
                {PRESENTATION_BUILD_TRIGGERS.map((trigger) => (
                  <button
                    type="button"
                    disabled={
                      builds.length === 0 && trigger.value !== "on-click"
                    }
                    data-active={
                      (builds.length === 0 ? "on-click" : animationTrigger) ===
                      trigger.value
                    }
                    key={trigger.value}
                    onClick={() => setAnimationTrigger(trigger.value)}
                  >
                    {trigger.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="presentation-animation__add"
              disabled={selectionAlreadyHasBuild}
              onClick={() =>
                onPresentationBuildAdd({
                  frameId: selectedFrameId,
                  targetIds: selectedObjects.map((element) => element.id),
                  effect: animationEffect,
                  trigger: builds.length === 0 ? "on-click" : animationTrigger,
                  direction: animationDirection,
                })
              }
            >
              {MagicIcon}
              <span>
                {selectionAlreadyHasBuild
                  ? "Already in build order"
                  : selectedObjects.length > 1
                  ? "Animate together"
                  : "Add to build order"}
              </span>
            </button>
          </section>
        ) : (
          <section className="presentation-animation__empty">
            <img
              className="presentation-animation__empty-art"
              src="/presentation/animation-empty-state.png"
              alt=""
              aria-hidden="true"
            />
            <strong>Choose a slide or its objects</strong>
            <span>Objects in the same frame can build together.</span>
          </section>
        )}

        {activeFrameId && (
          <section className="presentation-animation__section presentation-animation__builds">
            <div className="presentation-animation__heading">
              <span>Build order</span>
              <strong>{builds.length || "None"}</strong>
            </div>
            {builds.length ? (
              <ol>
                {builds.map((build, index) => (
                  <li key={build.id}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>
                        {build.targetIds.length}{" "}
                        {build.targetIds.length === 1 ? "object" : "objects"}
                      </strong>
                      <small>
                        {PRESENTATION_BUILD_EFFECTS.find(
                          (effect) => effect.value === build.effect,
                        )?.label || build.effect}
                        {" · "}
                        {PRESENTATION_BUILD_TRIGGERS.find(
                          (trigger) => trigger.value === build.trigger,
                        )?.label || build.trigger}
                      </small>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete build ${index + 1}`}
                      title="Delete build"
                      onClick={() => onPresentationBuildDelete(build.id)}
                    >
                      {TrashIcon}
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Nothing animates on this slide yet.</p>
            )}
          </section>
        )}
      </div>
    );
  };

  const updateResourceRow = (
    rowId: string,
    key: "label" | "value",
    value: string,
  ) => {
    setResourceConfig((currentConfig) =>
      currentConfig
        ? {
            ...currentConfig,
            rows: currentConfig.rows.map((row) =>
              row.id === rowId ? { ...row, [key]: value } : row,
            ),
          }
        : currentConfig,
    );
  };

  const renderResourceConfig = (config: PresentationResourceConfig) => {
    const resource = getPresentationResource(config.resourceId);

    return (
      <div className="presentation-resource-editor">
        <div className="presentation-resource-editor__header">
          <button
            className="presentation-resource-editor__back"
            type="button"
            aria-label="Back to resources"
            title="Back"
            onClick={() => setResourceConfig(null)}
          >
            {ArrowRightIcon}
          </button>
          <div className="presentation-resource-editor__resource-name">
            <strong>{resource?.label || "Resource"}</strong>
          </div>
        </div>

        <label className="presentation-resource-title">
          <span>Slide title</span>
          <input
            aria-label="Resource title"
            value={config.title}
            onChange={(event) =>
              setResourceConfig((currentConfig) =>
                currentConfig
                  ? { ...currentConfig, title: event.target.value }
                  : currentConfig,
              )
            }
          />
        </label>

        <section className="presentation-resource-section presentation-resource-style">
          <h3>Style</h3>
          <div>
            {(["clean", "colorful", "executive"] as const).map((style) => (
              <button
                type="button"
                key={style}
                data-active={config.style === style}
                onClick={() =>
                  setResourceConfig((currentConfig) =>
                    currentConfig ? { ...currentConfig, style } : currentConfig,
                  )
                }
              >
                {style}
              </button>
            ))}
          </div>
        </section>

        <section className="presentation-resource-section presentation-resource-rows">
          <div className="presentation-resource-rows__header">
            <h3>Data</h3>
            <button
              type="button"
              aria-label="Add data row"
              title="Add data row"
              onClick={() =>
                setResourceConfig((currentConfig) =>
                  currentConfig
                    ? {
                        ...currentConfig,
                        rows: [
                          ...currentConfig.rows,
                          { id: resourceRowId(), label: "Item", value: "50" },
                        ],
                      }
                    : currentConfig,
                )
              }
            >
              {PlusIcon}
            </button>
          </div>
          <div className="presentation-resource-row__labels" aria-hidden="true">
            <span>Label</span>
            <span>Value</span>
          </div>
          {config.rows.map((row, index) => (
            <div className="presentation-resource-row" key={row.id}>
              <input
                aria-label={`Label ${index + 1}`}
                value={row.label}
                onChange={(event) =>
                  updateResourceRow(row.id, "label", event.target.value)
                }
              />
              <input
                aria-label={`Value ${index + 1}`}
                value={row.value}
                onChange={(event) =>
                  updateResourceRow(row.id, "value", event.target.value)
                }
              />
              <button
                type="button"
                aria-label={`Remove row ${index + 1}`}
                title="Remove"
                disabled={config.rows.length <= 1}
                onClick={() =>
                  setResourceConfig((currentConfig) =>
                    currentConfig
                      ? {
                          ...currentConfig,
                          rows: currentConfig.rows.filter(
                            (currentRow) => currentRow.id !== row.id,
                          ),
                        }
                      : currentConfig,
                  )
                }
              >
                {TrashIcon}
              </button>
            </div>
          ))}
        </section>

        <input
          ref={resourceImportInputRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";

            if (!file) {
              return;
            }

            const reader = new FileReader();
            reader.onload = () => {
              const rows = parseResourceRows(String(reader.result || ""));
              if (rows.length) {
                setResourceConfig((currentConfig) =>
                  currentConfig ? { ...currentConfig, rows } : currentConfig,
                );
              }
            };
            reader.readAsText(file);
          }}
        />
      </div>
    );
  };

  const renderResources = () => {
    if (resourceConfig) {
      return renderResourceConfig(resourceConfig);
    }

    return (
      <div className="presentation-resource-sections">
        {PRESENTATION_RESOURCE_SECTIONS.map((section) => (
          <section
            className="presentation-template-section"
            key={section.title}
          >
            <div className="presentation-panel-section-heading">
              <span>{section.title}</span>
            </div>
            <div className="presentation-card-grid">
              {section.items.map((item) => (
                <button
                  type="button"
                  className="presentation-resource-card"
                  data-resource={item.id}
                  data-tone={item.tone}
                  key={item.id}
                  onClick={() =>
                    setResourceConfig(createPresentationResourceConfig(item.id))
                  }
                >
                  <span
                    className="presentation-resource-card__thumbnail"
                    aria-hidden="true"
                  >
                    <i />
                    <b />
                    <em />
                    <small />
                  </span>
                  <strong>{item.label}</strong>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  };

  const renderLayout = () => (
    <fieldset className="presentation-layout-options">
      <legend>Arrange slide frames</legend>
      {[
        ["horizontal", "Horizontal"],
        ["vertical", "Vertical"],
        ["grid", "Grid"],
        ["freeform", "Freeform"],
      ].map(([value, label]) => (
        <label className="presentation-layout-option" key={value}>
          <input
            type="radio"
            name="presentation-layout"
            value={value}
            checked={activeLayout === value}
            onChange={() => {
              const nextLayout = value as PresentationLayout;
              setActiveLayout(nextLayout);
              onLayoutChange(nextLayout);
            }}
          />
          <span>{label}</span>
        </label>
      ))}
    </fieldset>
  );

  return (
    <div className="presentation-panel">
      <div className="presentation-panel-tabs" aria-label="Presentation tools">
        {PRESENTATION_TABS.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className="presentation-panel-tab"
            data-active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
            title={tab.label}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="presentation-panel-content-shell">
        <div className="presentation-panel-content">
          {activeTab === "slides" && renderSlides()}
          {activeTab === "templates" && renderTemplates()}
          {activeTab === "animation" && renderAnimation()}
          {activeTab === "resources" && renderResources()}
          {activeTab === "layout" && renderLayout()}
        </div>
      </div>

      {activeTab === "resources" && resourceConfig ? (
        <div className="presentation-panel-footer presentation-panel-footer--resource">
          <div className="presentation-resource-editor__dock">
            <button
              type="button"
              className="presentation-resource-import"
              onClick={() => resourceImportInputRef.current?.click()}
            >
              {LoadIcon}
              <span>Import</span>
            </button>
            <button
              type="button"
              className="presentation-resource-insert"
              onClick={() => onResourceInsert(resourceConfig, activeLayout)}
            >
              {PlusIcon}
              <span>Insert</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="presentation-panel-footer">
          <button
            type="button"
            className="presentation-present-button"
            disabled={!frames.length}
            onClick={onStartPresentation}
          >
            {start}
            <span>Present</span>
          </button>
        </div>
      )}
    </div>
  );
};

export const AppSidebar = ({
  authStatus,
  displayName,
  canvasTitle,
  isCollaborating,
  comments,
  presentationElements,
  presentationAppState,
  presentationFiles,
  onPresentationSlideFocus,
  onPresentationStart,
  onPresentationLayoutChange,
  onPresentationTemplateInsert,
  onPresentationResourceInsert,
  onPresentationSlideRename,
  onPresentationSlideDelete,
  onPresentationSlideReorder,
  presentationAnimationMetadata,
  onPresentationBuildAdd,
  onPresentationBuildDelete,
  onPresentationSlideTransitionChange,
  onSignIn,
  onStartPlacement,
  onGoToComment,
  onCommentsOpenChange,
}: {
  authStatus: "loading" | "anonymous" | "authenticated";
  displayName: string;
  canvasTitle: string;
  isCollaborating: boolean;
  comments: CanvasCommentsController;
  presentationElements: readonly OrderedExcalidrawElement[];
  presentationAppState: PresentationExportAppState;
  presentationFiles: BinaryFiles;
  onPresentationSlideFocus: (frameId: string) => void;
  onPresentationStart: () => void;
  onPresentationLayoutChange: (layout: PresentationLayout) => void;
  onPresentationTemplateInsert: (
    templateId: PresentationTemplateId,
    layout: PresentationLayout,
  ) => void;
  onPresentationResourceInsert: (
    config: PresentationResourceConfig,
    layout: PresentationLayout,
  ) => void;
  onPresentationSlideRename: (frameId: string, name: string) => void;
  onPresentationSlideDelete: (
    frameId: string,
    layout: PresentationLayout,
  ) => void;
  onPresentationSlideReorder: (
    frameId: string,
    targetFrameId: string,
    layout: PresentationLayout,
  ) => void;
  presentationAnimationMetadata: PresentationAnimationMetadata;
  onPresentationBuildAdd: (build: Omit<PresentationBuild, "id">) => void;
  onPresentationBuildDelete: (buildId: string) => void;
  onPresentationSlideTransitionChange: (
    frameId: string,
    transition: PresentationSlideTransition,
  ) => void;
  onSignIn: () => void;
  onStartPlacement: () => void;
  onGoToComment: (comment: CanvasComment) => void;
  onCommentsOpenChange: (open: boolean) => void;
}) => {
  const { theme, openSidebar } = useUIAppState();

  useEffect(() => {
    onCommentsOpenChange(openSidebar?.tab === "comments");
  }, [onCommentsOpenChange, openSidebar?.tab]);

  return (
    <DefaultSidebar>
      <DefaultSidebar.TabTriggers>
        <Sidebar.TabTrigger tab="comments">
          {messageCircleIcon}
        </Sidebar.TabTrigger>
        <Sidebar.TabTrigger tab="presentation">
          {presentationIcon}
        </Sidebar.TabTrigger>
      </DefaultSidebar.TabTriggers>
      <Sidebar.Tab tab="comments">
        <CommentsSidebar
          authStatus={authStatus}
          displayName={displayName}
          canvasTitle={canvasTitle}
          isCollaborating={isCollaborating}
          placeholderImage={`/oss_promo_comments_${
            theme === THEME.DARK ? "dark" : "light"
          }.jpg`}
          controller={comments}
          onSignIn={onSignIn}
          onStartPlacement={onStartPlacement}
          onGoToComment={onGoToComment}
        />
      </Sidebar.Tab>
      <Sidebar.Tab tab="presentation">
        <PresentationPanel
          elements={presentationElements}
          appState={presentationAppState}
          files={presentationFiles}
          onFocusSlide={onPresentationSlideFocus}
          onStartPresentation={onPresentationStart}
          onLayoutChange={onPresentationLayoutChange}
          onTemplateInsert={onPresentationTemplateInsert}
          onResourceInsert={onPresentationResourceInsert}
          onRenameSlide={onPresentationSlideRename}
          onDeleteSlide={onPresentationSlideDelete}
          onReorderSlide={onPresentationSlideReorder}
          animationMetadata={presentationAnimationMetadata}
          onPresentationBuildAdd={onPresentationBuildAdd}
          onPresentationBuildDelete={onPresentationBuildDelete}
          onPresentationSlideTransitionChange={
            onPresentationSlideTransitionChange
          }
        />
      </Sidebar.Tab>
    </DefaultSidebar>
  );
};
