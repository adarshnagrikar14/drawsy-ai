import {
  ArrowRightIcon,
  frameToolIcon,
  PlusIcon,
  presentationIcon,
  stackPushIcon,
  TrashIcon,
} from "@excalidraw/excalidraw/components/icons";
import { openConfirmModal } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
import Spinner from "@excalidraw/excalidraw/components/Spinner";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  CanvasDocumentMetadata,
  WorkspaceIndex,
  WorkspaceProject,
} from "../data/WorkspaceStore";
import type {
  PresentationDocumentMetadata,
  PresentationIndex,
} from "../data/PresentationStore";

type WorkspaceHistoryItem =
  | CanvasDocumentMetadata
  | WorkspaceProject
  | PresentationDocumentMetadata;

type Props = {
  index: WorkspaceIndex | null;
  kanbanActive?: boolean;
  disabled: boolean;
  onCreateCanvas: () => void;
  onCreateProject: () => void;
  onOpenKanban: () => void;
  presentationIndex?: PresentationIndex | null;
  presentationActive?: boolean;
  onCreatePresentation?: () => void;
  onOpenPresentation?: (presentationId: string) => void;
  onDeletePresentation?: (presentationId: string) => Promise<boolean>;
  onCreateProjectCanvas: (projectId: string) => void;
  onOpenCanvas: (canvasId: string) => void;
  onDeleteCanvas: (canvasId: string) => Promise<boolean>;
  onDeleteProject: (projectId: string) => Promise<boolean>;
  loadingCanvasId?: string | null;
  loadingPresentationId?: string | null;
};

const sortByRecent = <T extends { lastOpenedAt: number }>(items: T[]) =>
  [...items].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);

const COLLAPSED_HISTORY_LIMIT = 5;
const DELETE_ANIMATION_MS = 180;

const HistoryPanel = ({
  items,
  emptyLabel,
  onSelect,
  onDelete,
  onHover,
  onScroll,
  onItemRef,
  disabled,
  currentItemId,
  loadingItemId,
  expanded,
  onToggleExpanded,
  className = "",
  style,
  footer,
  itemKind,
  leadingIcon,
  trailingIcon,
}: {
  items: WorkspaceHistoryItem[];
  emptyLabel: string;
  onSelect: (item: WorkspaceHistoryItem) => void;
  onDelete: (item: WorkspaceHistoryItem) => Promise<boolean>;
  onHover?: (item: WorkspaceHistoryItem, anchor: HTMLButtonElement) => void;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
  onItemRef?: (itemId: string, element: HTMLButtonElement | null) => void;
  disabled?: boolean;
  currentItemId?: string | null;
  loadingItemId?: string | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  className?: string;
  style?: React.CSSProperties;
  footer?: React.ReactNode;
  itemKind?: "canvas" | "project" | "presentation";
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}) => {
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const visibleItems = expanded
    ? items
    : items.slice(0, COLLAPSED_HISTORY_LIMIT);
  const hasOverflow = items.length > COLLAPSED_HISTORY_LIMIT;

  const deleteItem = async (item: WorkspaceHistoryItem) => {
    const isProject = "canvasIds" in item;
    const label = itemKind || (isProject ? "project" : "canvas");
    const confirmed = await openConfirmModal({
      title: `Delete ${label}?`,
      description: isProject ? (
        <>
          <strong>{item.title}</strong> and {item.canvasIds.length}{" "}
          {item.canvasIds.length === 1 ? "canvas" : "canvases"} will be
          permanently deleted.
          <br />
          This cannot be undone.
        </>
      ) : (
        <>
          <strong>{item.title}</strong> will be permanently deleted.
          <br />
          This cannot be undone.
        </>
      ),
      actionLabel: `Delete ${label}`,
      color: "danger",
    });
    if (!confirmed) {
      return;
    }

    setRemovingItemId(item.id);
    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!prefersReducedMotion) {
      await new Promise((resolve) =>
        window.setTimeout(resolve, DELETE_ANIMATION_MS),
      );
    }
    if (!(await onDelete(item))) {
      setRemovingItemId(null);
    }
  };

  return (
    <div className={`workspace-history-panel ${className}`} style={style}>
      <div className="workspace-history-list" onScroll={onScroll}>
        {visibleItems.length ? (
          visibleItems.map((item, itemIndex) => (
            <div
              className={`workspace-history-row ${
                removingItemId === item.id ? "is-removing" : ""
              } ${currentItemId === item.id ? "is-current" : ""} ${
                loadingItemId === item.id ? "is-loading" : ""
              }`}
              key={item.id}
              style={
                {
                  "--workspace-row-index": Math.min(itemIndex, 5),
                } as React.CSSProperties
              }
            >
              <button
                type="button"
                className="workspace-history-item"
                aria-current={currentItemId === item.id ? "page" : undefined}
                aria-busy={loadingItemId === item.id || undefined}
                ref={(element) => onItemRef?.(item.id, element)}
                onClick={() => onSelect(item)}
                onMouseEnter={(event) =>
                  !disabled && onHover?.(item, event.currentTarget)
                }
                onFocus={(event) =>
                  !disabled && onHover?.(item, event.currentTarget)
                }
                disabled={disabled || !!loadingItemId}
              >
                <span className="workspace-history-item-label">
                  {leadingIcon}
                  <span>{item.title}</span>
                </span>
                {loadingItemId === item.id ? (
                  <Spinner
                    className="workspace-history-loading"
                    size="1rem"
                    circleWidth={9}
                    synchronized
                  />
                ) : (
                  trailingIcon || ("canvasIds" in item && ArrowRightIcon)
                )}
              </button>
              <button
                type="button"
                className="workspace-history-delete"
                aria-label={`Delete ${item.title}`}
                title={`Delete ${item.title}`}
                onClick={() => void deleteItem(item)}
                disabled={
                  disabled || !!loadingItemId || removingItemId === item.id
                }
              >
                {TrashIcon}
              </button>
            </div>
          ))
        ) : (
          <div className="workspace-history-empty">{emptyLabel}</div>
        )}
        {hasOverflow && (
          <button
            type="button"
            className="workspace-history-toggle"
            onClick={onToggleExpanded}
            disabled={disabled}
            aria-expanded={expanded}
          >
            {expanded ? "Show less" : `Show all (${items.length})`}
          </button>
        )}
        {footer}
      </div>
    </div>
  );
};

export const WorkspaceMenu = ({
  index,
  kanbanActive = false,
  disabled,
  onCreateCanvas,
  onCreateProject,
  onOpenKanban,
  presentationIndex = null,
  presentationActive = false,
  onCreatePresentation,
  onOpenPresentation,
  onDeletePresentation,
  onCreateProjectCanvas,
  onOpenCanvas,
  onDeleteCanvas,
  onDeleteProject,
  loadingCanvasId = null,
  loadingPresentationId = null,
}: Props) => {
  const [branch, setBranch] = useState<
    "canvases" | "projects" | "presentations" | null
  >(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectPanelTop, setProjectPanelTop] = useState<number | null>(null);
  const [expandedCanvases, setExpandedCanvases] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState(false);
  const [expandedProjectCanvases, setExpandedProjectCanvases] = useState(false);
  const [expandedPresentations, setExpandedPresentations] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const projectButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  const standaloneCanvases = useMemo(
    () =>
      sortByRecent(index?.canvases.filter((canvas) => !canvas.projectId) || []),
    [index],
  );
  const projects = useMemo(() => sortByRecent(index?.projects || []), [index]);
  const presentations = useMemo(
    () => sortByRecent(presentationIndex?.presentations || []),
    [presentationIndex],
  );
  const projectCanvases = useMemo(
    () =>
      sortByRecent(
        index?.canvases.filter(
          (canvas) => canvas.projectId === activeProjectId,
        ) || [],
      ),
    [activeProjectId, index],
  );
  const currentCanvas = index?.canvases.find(
    (canvas) => canvas.id === index.activeCanvasId,
  );
  const interactionDisabled =
    disabled || !!loadingCanvasId || !!loadingPresentationId;
  const updateProjectPanelPosition = useCallback(
    (projectId: string, anchor?: HTMLButtonElement) => {
      const menu = menuRef.current;
      const button = anchor || projectButtonRefs.current.get(projectId);
      const list = button?.closest<HTMLElement>(".workspace-history-list");
      if (!menu || !button || !list) {
        return;
      }

      const buttonRect = button.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      if (
        buttonRect.bottom <= listRect.top ||
        buttonRect.top >= listRect.bottom
      ) {
        setActiveProjectId((current) =>
          current === projectId ? null : current,
        );
        setProjectPanelTop(null);
        return;
      }

      setProjectPanelTop(buttonRect.top - menu.getBoundingClientRect().top);
    },
    [],
  );

  const activateProject = useCallback(
    (project: WorkspaceProject, anchor?: HTMLButtonElement) => {
      setActiveProjectId(project.id);
      updateProjectPanelPosition(project.id, anchor);
    },
    [updateProjectPanelPosition],
  );

  useEffect(() => {
    if (disabled) {
      setBranch(null);
      setActiveProjectId(null);
      setProjectPanelTop(null);
      setExpandedCanvases(false);
      setExpandedProjects(false);
      setExpandedProjectCanvases(false);
      setExpandedPresentations(false);
    }
  }, [disabled]);

  useEffect(() => {
    setExpandedProjectCanvases(false);
  }, [activeProjectId]);

  const showBranch = (
    nextBranch: "canvases" | "projects" | "presentations",
  ) => {
    if (disabled) {
      return;
    }
    setBranch(nextBranch);
    if (nextBranch !== "projects") {
      setActiveProjectId(null);
      setProjectPanelTop(null);
    }
  };

  return (
    <div
      ref={menuRef}
      className="workspace-add-menu"
      data-testid="workspace-add-menu"
    >
      <div className="workspace-create-card add-menu-card">
        <button
          type="button"
          className="workspace-create-action"
          onClick={onCreateCanvas}
          disabled={interactionDisabled}
        >
          <span className="workspace-menu-icon" aria-hidden="true">
            {frameToolIcon}
          </span>
          <span>New Canvas</span>
        </button>
        <button
          type="button"
          className="workspace-branch-trigger"
          aria-label="Recent standalone canvases"
          aria-expanded={branch === "canvases"}
          onMouseEnter={() => showBranch("canvases")}
          onFocus={() => showBranch("canvases")}
          onClick={() => showBranch("canvases")}
          disabled={interactionDisabled}
        >
          {ArrowRightIcon}
        </button>
      </div>

      <div className="workspace-create-card add-menu-card">
        <button
          type="button"
          className="workspace-create-action"
          onClick={onCreateProject}
          disabled={interactionDisabled}
        >
          <span className="workspace-menu-icon" aria-hidden="true">
            {stackPushIcon}
          </span>
          <span>New Project</span>
        </button>
        <button
          type="button"
          className="workspace-branch-trigger"
          aria-label="Recent projects"
          aria-expanded={branch === "projects"}
          onMouseEnter={() => showBranch("projects")}
          onFocus={() => showBranch("projects")}
          onClick={() => showBranch("projects")}
          disabled={interactionDisabled}
        >
          {ArrowRightIcon}
        </button>
      </div>

      <div
        className={`workspace-create-card add-menu-card workspace-kanban-card ${
          kanbanActive ? "is-current" : ""
        }`}
      >
        <button
          type="button"
          className="workspace-create-action"
          onClick={onOpenKanban}
          disabled={interactionDisabled}
          aria-current={kanbanActive ? "page" : undefined}
        >
          <span
            className="workspace-menu-icon workspace-kanban-icon"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="16" rx="2.5" />
              <path d="M9 4v16M15 4v16" />
              <path d="M5.5 7h1M11.5 7h1M17.5 7h1" />
            </svg>
          </span>
          <span>Kanban</span>
        </button>
        <button
          type="button"
          className="workspace-branch-trigger"
          aria-label="Open Kanban"
          onClick={onOpenKanban}
          disabled={interactionDisabled}
        >
          {ArrowRightIcon}
        </button>
      </div>

      <div
        className={`workspace-create-card add-menu-card workspace-presentation-card ${
          presentationActive ? "is-current" : ""
        }`}
      >
        <button
          type="button"
          className="workspace-create-action"
          onClick={onCreatePresentation}
          disabled={interactionDisabled || !onCreatePresentation}
        >
          <span className="workspace-menu-icon" aria-hidden="true">
            {presentationIcon}
          </span>
          <span>New Presentation</span>
        </button>
        <button
          type="button"
          className="workspace-branch-trigger"
          aria-label="Recent presentations"
          aria-expanded={branch === "presentations"}
          onMouseEnter={() => showBranch("presentations")}
          onFocus={() => showBranch("presentations")}
          onClick={() => showBranch("presentations")}
          disabled={interactionDisabled || !onOpenPresentation}
        >
          {ArrowRightIcon}
        </button>
      </div>

      {Array.from({ length: 2 }, (_, index) => (
        <div
          className="add-menu-card workspace-create-placeholder"
          key={index}
        />
      ))}

      {branch === "canvases" && (
        <HistoryPanel
          items={standaloneCanvases}
          emptyLabel="No recent canvases"
          onSelect={(item) => onOpenCanvas(item.id)}
          onDelete={(item) => onDeleteCanvas(item.id)}
          disabled={interactionDisabled}
          currentItemId={
            currentCanvas?.projectId ? null : index?.activeCanvasId
          }
          loadingItemId={loadingCanvasId}
          expanded={expandedCanvases}
          onToggleExpanded={() => setExpandedCanvases((current) => !current)}
          className="workspace-history-panel--canvases"
          leadingIcon={frameToolIcon}
        />
      )}

      {branch === "projects" && (
        <HistoryPanel
          items={projects}
          emptyLabel="No recent projects"
          onSelect={(item) => {
            if ("canvasIds" in item) {
              activateProject(item);
            }
          }}
          onHover={(item, anchor) => {
            if ("canvasIds" in item) {
              activateProject(item, anchor);
            }
          }}
          onDelete={(item) => onDeleteProject(item.id)}
          onScroll={() => {
            if (activeProjectId) {
              updateProjectPanelPosition(activeProjectId);
            }
          }}
          onItemRef={(itemId, element) => {
            if (element) {
              projectButtonRefs.current.set(itemId, element);
            } else {
              projectButtonRefs.current.delete(itemId);
            }
          }}
          disabled={interactionDisabled}
          currentItemId={currentCanvas?.projectId}
          expanded={expandedProjects}
          onToggleExpanded={() => {
            setExpandedProjects((current) => !current);
            setActiveProjectId(null);
            setProjectPanelTop(null);
          }}
          className="workspace-history-panel--projects"
          leadingIcon={stackPushIcon}
        />
      )}

      {branch === "projects" && activeProjectId && projectPanelTop !== null && (
        <HistoryPanel
          items={projectCanvases}
          emptyLabel="No canvases"
          onSelect={(item) => onOpenCanvas(item.id)}
          onDelete={(item) => onDeleteCanvas(item.id)}
          disabled={interactionDisabled}
          currentItemId={index?.activeCanvasId}
          loadingItemId={loadingCanvasId}
          expanded={expandedProjectCanvases}
          onToggleExpanded={() =>
            setExpandedProjectCanvases((current) => !current)
          }
          className="workspace-history-panel--project-canvases"
          leadingIcon={frameToolIcon}
          style={
            {
              "--workspace-panel-top": `${projectPanelTop}px`,
              top: `${projectPanelTop}px`,
            } as React.CSSProperties
          }
          footer={
            <button
              type="button"
              className="workspace-history-item workspace-create-project-canvas"
              onClick={() => onCreateProjectCanvas(activeProjectId)}
              disabled={interactionDisabled}
            >
              <span className="workspace-history-item-label">
                {PlusIcon}
                <span>Create canvas</span>
              </span>
            </button>
          }
        />
      )}

      {branch === "presentations" && (
        <HistoryPanel
          items={presentations}
          emptyLabel="No presentations yet"
          onSelect={(item) => onOpenPresentation?.(item.id)}
          onDelete={(item) =>
            onDeletePresentation
              ? onDeletePresentation(item.id)
              : Promise.resolve(false)
          }
          disabled={interactionDisabled || !onOpenPresentation}
          currentItemId={
            presentationActive
              ? presentationIndex?.activePresentationId || null
              : null
          }
          loadingItemId={loadingPresentationId}
          expanded={expandedPresentations}
          onToggleExpanded={() =>
            setExpandedPresentations((current) => !current)
          }
          className="workspace-history-panel--presentations"
          itemKind="presentation"
          leadingIcon={presentationIcon}
        />
      )}
    </div>
  );
};
