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
  messageCircleIcon,
  palette,
  presentationIcon,
  start,
} from "@excalidraw/excalidraw/components/icons";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import {
  getFrameChildren,
  getNonDeletedElements,
  isFrameLikeElement,
} from "@excalidraw/element";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawFrameLikeElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";

import { CommentsSidebar } from "../comments/CommentsSidebar";

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
}) => {
  const [activeTab, setActiveTab] = useState<PresentationPanelTab>("slides");
  const [activeLayout, setActiveLayout] =
    useState<PresentationLayout>("freeform");

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

          return (
            <button
              type="button"
              className="presentation-slide-card"
              key={frame.id}
              onClick={() => onFocusSlide(frame.id)}
            >
              <PresentationSlideThumbnail
                index={index}
                frame={frame}
                elements={elements}
                appState={appState}
                files={files}
              />
              <div className="presentation-slide-card__body">
                <strong>{title}</strong>
                <span>
                  {Math.round(frame.width)} x {Math.round(frame.height)} ·{" "}
                  {childCount} {childCount === 1 ? "item" : "items"}
                </span>
              </div>
            </button>
          );
        })}
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

  const renderAnimation = () => (
    <div className="presentation-stack">
      {["Slide transition", "Element entrance", "Emphasis", "Motion path"].map(
        (label) => (
          <div className="presentation-option-row" key={label}>
            <span>{label}</span>
            <small>effect layer</small>
          </div>
        ),
      )}
    </div>
  );

  const renderResources = () => (
    <div className="presentation-card-grid">
      {["Charts", "Graphs", "Tables", "Media"].map((label) => (
        <div className="presentation-resource-card" key={label}>
          <strong>{label}</strong>
          <span />
        </div>
      ))}
    </div>
  );

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
        />
      </Sidebar.Tab>
    </DefaultSidebar>
  );
};
