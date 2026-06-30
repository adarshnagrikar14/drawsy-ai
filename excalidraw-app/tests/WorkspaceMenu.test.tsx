import { fireEvent, render, screen } from "@testing-library/react";

import { WorkspaceMenu } from "../components/WorkspaceMenu";

import type { WorkspaceIndex } from "../data/WorkspaceStore";

const index: WorkspaceIndex = {
  schemaVersion: 1,
  activeCanvasId: "standalone",
  canvases: [
    {
      id: "standalone",
      title: "Product Ideas",
      projectId: null,
      version: 1,
      createdAt: 1,
      updatedAt: 1,
      lastOpenedAt: 3,
    },
    {
      id: "project-canvas",
      title: "Research",
      projectId: "project",
      version: 1,
      createdAt: 1,
      updatedAt: 1,
      lastOpenedAt: 2,
    },
  ],
  projects: [
    {
      id: "project",
      title: "excal-ai",
      canvasIds: ["project-canvas"],
      createdAt: 1,
      updatedAt: 1,
      lastOpenedAt: 2,
    },
  ],
};

describe("WorkspaceMenu", () => {
  it("creates canvases and exposes standalone history from the arrow", async () => {
    const onCreateCanvas = vi.fn();
    const onOpenCanvas = vi.fn();
    render(
      <WorkspaceMenu
        index={index}
        disabled={false}
        onCreateCanvas={onCreateCanvas}
        onCreateProject={vi.fn()}
        onCreateProjectCanvas={vi.fn()}
        onOpenCanvas={onOpenCanvas}
      />,
    );

    fireEvent.click(screen.getByText("New Canvas"));
    expect(onCreateCanvas).toHaveBeenCalledTimes(1);

    fireEvent.mouseEnter(screen.getByLabelText("Recent standalone canvases"));
    fireEvent.click(screen.getByText("Product Ideas"));
    expect(onOpenCanvas).toHaveBeenCalledWith("standalone");
    expect(screen.queryByText("Research")).toBeNull();
  });

  it("reveals project canvases after hovering a recent project", async () => {
    const onOpenCanvas = vi.fn();
    const onCreateProjectCanvas = vi.fn();
    render(
      <WorkspaceMenu
        index={index}
        disabled={false}
        onCreateCanvas={vi.fn()}
        onCreateProject={vi.fn()}
        onCreateProjectCanvas={onCreateProjectCanvas}
        onOpenCanvas={onOpenCanvas}
      />,
    );

    fireEvent.mouseEnter(screen.getByLabelText("Recent projects"));
    fireEvent.mouseEnter(screen.getByText("excal-ai"));
    fireEvent.click(screen.getByText("Research"));
    expect(onOpenCanvas).toHaveBeenCalledWith("project-canvas");

    fireEvent.click(screen.getByText("Create canvas"));
    expect(onCreateProjectCanvas).toHaveBeenCalledWith("project");
  });
});
