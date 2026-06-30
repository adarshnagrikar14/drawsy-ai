import {
  ArrowRightIcon,
  PlusIcon,
} from "@excalidraw/excalidraw/components/icons";
import React, { useMemo, useState } from "react";

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
};

const sortByRecent = <T extends { lastOpenedAt: number }>(items: T[]) =>
  [...items].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);

const byRecent = <T extends { lastOpenedAt: number }>(items: T[]) =>
  sortByRecent(items).slice(0, 5);

const HistoryPanel = ({
  items,
  emptyLabel,
  onSelect,
  onHover,
  className = "",
  style,
  footer,
}: {
  items: Array<CanvasDocumentMetadata | WorkspaceProject>;
  emptyLabel: string;
  onSelect: (item: CanvasDocumentMetadata | WorkspaceProject) => void;
  onHover?: (item: CanvasDocumentMetadata | WorkspaceProject) => void;
  className?: string;
  style?: React.CSSProperties;
  footer?: React.ReactNode;
}) => (
  <div className={`workspace-history-panel ${className}`} style={style}>
    <div className="workspace-history-list">
      {items.length ? (
        items.map((item) => (
          <button
            type="button"
            className="workspace-history-item"
            key={item.id}
            onClick={() => onSelect(item)}
            onMouseEnter={() => onHover?.(item)}
            onFocus={() => onHover?.(item)}
          >
            <span>{item.title}</span>
            {"canvasIds" in item && ArrowRightIcon}
          </button>
        ))
      ) : (
        <div className="workspace-history-empty">{emptyLabel}</div>
      )}
      {footer}
    </div>
  </div>
);

export const WorkspaceMenu = ({
  index,
  disabled,
  onCreateCanvas,
  onCreateProject,
  onCreateProjectCanvas,
  onOpenCanvas,
}: Props) => {
  const [branch, setBranch] = useState<"canvases" | "projects" | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const standaloneCanvases = useMemo(
    () => byRecent(index?.canvases.filter((canvas) => !canvas.projectId) || []),
    [index],
  );
  const projects = useMemo(() => byRecent(index?.projects || []), [index]);
  const projectCanvases = useMemo(
    () =>
      sortByRecent(
        index?.canvases.filter(
          (canvas) => canvas.projectId === activeProjectId,
        ) || [],
      ),
    [activeProjectId, index],
  );
  const activeProjectIndex = projects.findIndex(
    (project) => project.id === activeProjectId,
  );

  const showBranch = (nextBranch: "canvases" | "projects") => {
    setBranch(nextBranch);
    if (nextBranch === "canvases") {
      setActiveProjectId(null);
    }
  };

  return (
    <div className="workspace-add-menu" data-testid="workspace-add-menu">
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
          className="workspace-history-panel--canvases"
        />
      )}

      {branch === "projects" && (
        <HistoryPanel
          items={projects}
          emptyLabel="No recent projects"
          onSelect={(item) => {
            if ("canvasIds" in item) {
              setActiveProjectId(item.id);
            }
          }}
          onHover={(item) => {
            if ("canvasIds" in item) {
              setActiveProjectId(item.id);
            }
          }}
          className="workspace-history-panel--projects"
        />
      )}

      {branch === "projects" && activeProjectId && (
        <HistoryPanel
          items={projectCanvases}
          emptyLabel="No canvases"
          onSelect={(item) => onOpenCanvas(item.id)}
          className="workspace-history-panel--project-canvases"
          style={
            {
              "--workspace-panel-top": `${
                5.125 + Math.max(0, activeProjectIndex) * 4.25
              }rem`,
              top: `${5.125 + Math.max(0, activeProjectIndex) * 4.25}rem`,
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
