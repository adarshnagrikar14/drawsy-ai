import {
  ArrowRightIcon,
  PlusIcon,
  TrashIcon,
} from "@excalidraw/excalidraw/components/icons";
import { openConfirmModal } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
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

type Props = {
  index: WorkspaceIndex | null;
  disabled: boolean;
  onCreateCanvas: () => void;
  onCreateProject: () => void;
  onCreateProjectCanvas: (projectId: string) => void;
  onOpenCanvas: (canvasId: string) => void;
  onDeleteCanvas: (canvasId: string) => Promise<boolean>;
  onDeleteProject: (projectId: string) => Promise<boolean>;
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
  expanded,
  onToggleExpanded,
  className = "",
  style,
  footer,
}: {
  items: Array<CanvasDocumentMetadata | WorkspaceProject>;
  emptyLabel: string;
  onSelect: (item: CanvasDocumentMetadata | WorkspaceProject) => void;
  onDelete: (
    item: CanvasDocumentMetadata | WorkspaceProject,
  ) => Promise<boolean>;
  onHover?: (
    item: CanvasDocumentMetadata | WorkspaceProject,
    anchor: HTMLButtonElement,
  ) => void;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
  onItemRef?: (itemId: string, element: HTMLButtonElement | null) => void;
  disabled?: boolean;
  currentItemId?: string | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  className?: string;
  style?: React.CSSProperties;
  footer?: React.ReactNode;
}) => {
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const visibleItems = expanded
    ? items
    : items.slice(0, COLLAPSED_HISTORY_LIMIT);
  const hasOverflow = items.length > COLLAPSED_HISTORY_LIMIT;

  const deleteItem = async (
    item: CanvasDocumentMetadata | WorkspaceProject,
  ) => {
    const isProject = "canvasIds" in item;
    const confirmed = await openConfirmModal({
      title: isProject ? "Delete project?" : "Delete canvas?",
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
      actionLabel: isProject ? "Delete project" : "Delete canvas",
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
              } ${currentItemId === item.id ? "is-current" : ""}`}
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
                ref={(element) => onItemRef?.(item.id, element)}
                onClick={() => onSelect(item)}
                onMouseEnter={(event) =>
                  !disabled && onHover?.(item, event.currentTarget)
                }
                onFocus={(event) =>
                  !disabled && onHover?.(item, event.currentTarget)
                }
                disabled={disabled}
              >
                <span>{item.title}</span>
                {"canvasIds" in item && ArrowRightIcon}
              </button>
              <button
                type="button"
                className="workspace-history-delete"
                aria-label={`Delete ${item.title}`}
                title={`Delete ${item.title}`}
                onClick={() => void deleteItem(item)}
                disabled={disabled || removingItemId === item.id}
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
  disabled,
  onCreateCanvas,
  onCreateProject,
  onCreateProjectCanvas,
  onOpenCanvas,
  onDeleteCanvas,
  onDeleteProject,
}: Props) => {
  const [branch, setBranch] = useState<"canvases" | "projects" | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectPanelTop, setProjectPanelTop] = useState<number | null>(null);
  const [expandedCanvases, setExpandedCanvases] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState(false);
  const [expandedProjectCanvases, setExpandedProjectCanvases] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const projectButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  const standaloneCanvases = useMemo(
    () =>
      sortByRecent(index?.canvases.filter((canvas) => !canvas.projectId) || []),
    [index],
  );
  const projects = useMemo(() => sortByRecent(index?.projects || []), [index]);
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
    }
  }, [disabled]);

  useEffect(() => {
    setExpandedProjectCanvases(false);
  }, [activeProjectId]);

  const showBranch = (nextBranch: "canvases" | "projects") => {
    if (disabled) {
      return;
    }
    setBranch(nextBranch);
    if (nextBranch === "canvases") {
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
          disabled={disabled}
        >
          New Canvas
        </button>
        <button
          type="button"
          className="workspace-branch-trigger"
          aria-label="Recent standalone canvases"
          aria-expanded={branch === "canvases"}
          onMouseEnter={() => showBranch("canvases")}
          onFocus={() => showBranch("canvases")}
          onClick={() => showBranch("canvases")}
          disabled={disabled}
        >
          {ArrowRightIcon}
        </button>
      </div>

      <div className="workspace-create-card add-menu-card">
        <button
          type="button"
          className="workspace-create-action"
          onClick={onCreateProject}
          disabled={disabled}
        >
          New Project
        </button>
        <button
          type="button"
          className="workspace-branch-trigger"
          aria-label="Recent projects"
          aria-expanded={branch === "projects"}
          onMouseEnter={() => showBranch("projects")}
          onFocus={() => showBranch("projects")}
          onClick={() => showBranch("projects")}
          disabled={disabled}
        >
          {ArrowRightIcon}
        </button>
      </div>

      {Array.from({ length: 3 }, (_, index) => (
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
          disabled={disabled}
          currentItemId={
            currentCanvas?.projectId ? null : index?.activeCanvasId
          }
          expanded={expandedCanvases}
          onToggleExpanded={() => setExpandedCanvases((current) => !current)}
          className="workspace-history-panel--canvases"
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
          disabled={disabled}
          currentItemId={currentCanvas?.projectId}
          expanded={expandedProjects}
          onToggleExpanded={() => {
            setExpandedProjects((current) => !current);
            setActiveProjectId(null);
            setProjectPanelTop(null);
          }}
          className="workspace-history-panel--projects"
        />
      )}

      {branch === "projects" && activeProjectId && projectPanelTop !== null && (
        <HistoryPanel
          items={projectCanvases}
          emptyLabel="No canvases"
          onSelect={(item) => onOpenCanvas(item.id)}
          onDelete={(item) => onDeleteCanvas(item.id)}
          disabled={disabled}
          currentItemId={index?.activeCanvasId}
          expanded={expandedProjectCanvases}
          onToggleExpanded={() =>
            setExpandedProjectCanvases((current) => !current)
          }
          className="workspace-history-panel--project-canvases"
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
              disabled={disabled}
            >
              <span>Create canvas</span>
              {PlusIcon}
            </button>
          }
        />
      )}
    </div>
  );
};
