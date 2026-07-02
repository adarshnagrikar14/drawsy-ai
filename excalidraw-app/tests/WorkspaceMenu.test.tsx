import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { WorkspaceMenu } from "../components/WorkspaceMenu";

import type { WorkspaceIndex } from "../data/WorkspaceStore";

vi.mock(
  "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState",
  () => ({
    openConfirmModal: vi.fn(() => Promise.resolve(true)),
  }),
);

const index: WorkspaceIndex = {
  schemaVersion: 2,
  activeCanvasId: "standalone",
  pendingDeletes: [],
  canvases: [
    {
      id: "standalone",
      title: "Product Ideas",
      projectId: null,
      version: 1,
      createdAt: 1,
      updatedAt: 1,
      lastOpenedAt: 3,
      sync: { remoteVersion: 0, dirty: true },
    },
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `standalone-${index + 2}`,
      title: `Product Ideas ${index + 2}`,
      projectId: null,
      version: 1,
      createdAt: 1,
      updatedAt: 1,
      lastOpenedAt: 2 - index,
      sync: { remoteVersion: 0, dirty: true },
    })),
    {
      id: "project-canvas",
      title: "Research",
      projectId: "project",
      version: 1,
      createdAt: 1,
      updatedAt: 1,
      lastOpenedAt: 2,
      sync: { remoteVersion: 0, dirty: true },
    },
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `project-canvas-${index + 2}`,
      title: `Research ${index + 2}`,
      projectId: "project",
      version: 1,
      createdAt: 1,
      updatedAt: 1,
      lastOpenedAt: 1,
      sync: { remoteVersion: 0, dirty: true },
    })),
  ],
  projects: [
    {
      id: "project",
      title: "excal-ai",
      canvasIds: [
        "project-canvas",
        "project-canvas-2",
        "project-canvas-3",
        "project-canvas-4",
        "project-canvas-5",
        "project-canvas-6",
      ],
      createdAt: 1,
      updatedAt: 1,
      lastOpenedAt: 2,
      version: 1,
      sync: { remoteVersion: 0, dirty: true },
    },
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `project-${index + 2}`,
      title: `Project ${index + 2}`,
      canvasIds: [],
      createdAt: 1,
      updatedAt: 1,
      lastOpenedAt: 1 - index,
      version: 1,
      sync: { remoteVersion: 0, dirty: true },
    })),
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
        onDeleteCanvas={vi.fn()}
        onDeleteProject={vi.fn()}
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
    const { container } = render(
      <WorkspaceMenu
        index={index}
        disabled={false}
        onCreateCanvas={vi.fn()}
        onCreateProject={vi.fn()}
        onCreateProjectCanvas={onCreateProjectCanvas}
        onOpenCanvas={onOpenCanvas}
        onDeleteCanvas={vi.fn()}
        onDeleteProject={vi.fn()}
      />,
    );

    fireEvent.mouseEnter(screen.getByLabelText("Recent projects"));
    const projectButton = screen.getByText("excal-ai").closest("button")!;
    const menu = screen.getByTestId("workspace-add-menu");
    const projectList = container.querySelector<HTMLElement>(
      ".workspace-history-panel--projects .workspace-history-list",
    )!;
    let projectTop = 150;
    vi.spyOn(menu, "getBoundingClientRect").mockReturnValue({
      top: 50,
    } as DOMRect);
    vi.spyOn(projectList, "getBoundingClientRect").mockReturnValue({
      top: 100,
      bottom: 300,
    } as DOMRect);
    vi.spyOn(projectButton, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          top: projectTop,
          bottom: projectTop + 60,
        } as DOMRect),
    );

    fireEvent.mouseEnter(projectButton);
    expect(
      container.querySelector<HTMLElement>(
        ".workspace-history-panel--project-canvases",
      )?.style.top,
    ).toBe("100px");
    expect(screen.queryByText("Research 6")).toBeNull();
    const projectCanvasPanel = container.querySelector<HTMLElement>(
      ".workspace-history-panel--project-canvases",
    )!;
    fireEvent.click(
      projectCanvasPanel.querySelector<HTMLButtonElement>(
        ".workspace-history-toggle",
      )!,
    );
    expect(screen.getByText("Research 6")).not.toBeNull();

    projectTop = 120;
    fireEvent.scroll(projectList);
    expect(
      container.querySelector<HTMLElement>(
        ".workspace-history-panel--project-canvases",
      )?.style.top,
    ).toBe("70px");

    fireEvent.click(screen.getByText("Research"));
    expect(onOpenCanvas).toHaveBeenCalledWith("project-canvas");

    fireEvent.click(screen.getByText("Create canvas"));
    expect(onCreateProjectCanvas).toHaveBeenCalledWith("project");
  });

  it("expands and collapses every capped history branch", () => {
    render(
      <WorkspaceMenu
        index={index}
        disabled={false}
        onCreateCanvas={vi.fn()}
        onCreateProject={vi.fn()}
        onCreateProjectCanvas={vi.fn()}
        onOpenCanvas={vi.fn()}
        onDeleteCanvas={vi.fn()}
        onDeleteProject={vi.fn()}
      />,
    );

    fireEvent.mouseEnter(screen.getByLabelText("Recent standalone canvases"));
    expect(screen.queryByText("Product Ideas 6")).toBeNull();
    fireEvent.click(screen.getByText("Show all (6)"));
    expect(screen.getByText("Product Ideas 6")).not.toBeNull();
    fireEvent.click(screen.getByText("Show less"));
    expect(screen.queryByText("Product Ideas 6")).toBeNull();

    fireEvent.mouseEnter(screen.getByLabelText("Recent projects"));
    expect(screen.queryByText("Project 6")).toBeNull();
    fireEvent.click(screen.getByText("Show all (6)"));
    expect(screen.getByText("Project 6")).not.toBeNull();
  });

  it("routes canvas and project deletion from their cards", async () => {
    const onDeleteCanvas = vi.fn();
    const onDeleteProject = vi.fn();
    render(
      <WorkspaceMenu
        index={index}
        disabled={false}
        onCreateCanvas={vi.fn()}
        onCreateProject={vi.fn()}
        onCreateProjectCanvas={vi.fn()}
        onOpenCanvas={vi.fn()}
        onDeleteCanvas={onDeleteCanvas}
        onDeleteProject={onDeleteProject}
      />,
    );

    fireEvent.mouseEnter(screen.getByLabelText("Recent standalone canvases"));
    fireEvent.click(screen.getByLabelText("Delete Product Ideas"));
    await waitFor(() =>
      expect(onDeleteCanvas).toHaveBeenCalledWith("standalone"),
    );

    fireEvent.mouseEnter(screen.getByLabelText("Recent projects"));
    fireEvent.click(screen.getByLabelText("Delete excal-ai"));
    await waitFor(() =>
      expect(onDeleteProject).toHaveBeenCalledWith("project"),
    );
  });

  it("marks the current canvas and its project", () => {
    const projectIndex: WorkspaceIndex = {
      ...index,
      activeCanvasId: "project-canvas",
    };
    const { container } = render(
      <WorkspaceMenu
        index={projectIndex}
        disabled={false}
        onCreateCanvas={vi.fn()}
        onCreateProject={vi.fn()}
        onCreateProjectCanvas={vi.fn()}
        onOpenCanvas={vi.fn()}
        onDeleteCanvas={vi.fn()}
        onDeleteProject={vi.fn()}
      />,
    );

    fireEvent.mouseEnter(screen.getByLabelText("Recent projects"));
    const projectButton = screen.getByText("excal-ai").closest("button")!;
    expect(projectButton).toHaveAttribute("aria-current", "page");

    const menu = screen.getByTestId("workspace-add-menu");
    const projectList = container.querySelector<HTMLElement>(
      ".workspace-history-panel--projects .workspace-history-list",
    )!;
    vi.spyOn(menu, "getBoundingClientRect").mockReturnValue({
      top: 50,
    } as DOMRect);
    vi.spyOn(projectList, "getBoundingClientRect").mockReturnValue({
      top: 100,
      bottom: 300,
    } as DOMRect);
    vi.spyOn(projectButton, "getBoundingClientRect").mockReturnValue({
      top: 150,
      bottom: 210,
    } as DOMRect);
    fireEvent.mouseEnter(projectButton);
    expect(screen.getByText("Research").closest("button")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("closes branches and blocks interactions when disabled", async () => {
    const onOpenCanvas = vi.fn();
    const { rerender } = render(
      <WorkspaceMenu
        index={index}
        disabled={false}
        onCreateCanvas={vi.fn()}
        onCreateProject={vi.fn()}
        onCreateProjectCanvas={vi.fn()}
        onOpenCanvas={onOpenCanvas}
        onDeleteCanvas={vi.fn()}
        onDeleteProject={vi.fn()}
      />,
    );

    fireEvent.mouseEnter(screen.getByLabelText("Recent standalone canvases"));
    expect(screen.getByText("Product Ideas")).not.toBeNull();

    rerender(
      <WorkspaceMenu
        index={index}
        disabled={true}
        onCreateCanvas={vi.fn()}
        onCreateProject={vi.fn()}
        onCreateProjectCanvas={vi.fn()}
        onOpenCanvas={onOpenCanvas}
        onDeleteCanvas={vi.fn()}
        onDeleteProject={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.queryByText("Product Ideas")).toBeNull());
    fireEvent.mouseEnter(screen.getByLabelText("Recent standalone canvases"));
    expect(screen.queryByText("Product Ideas")).toBeNull();
    expect(onOpenCanvas).not.toHaveBeenCalled();
  });
});
