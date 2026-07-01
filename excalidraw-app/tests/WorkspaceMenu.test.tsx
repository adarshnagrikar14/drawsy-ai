import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `project-canvas-${index + 2}`,
      title: `Research ${index + 2}`,
      projectId: "project",
      version: 1,
      createdAt: 1,
      updatedAt: 1,
      lastOpenedAt: 1,
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
    const { container } = render(
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
      />,
    );

    await waitFor(() => expect(screen.queryByText("Product Ideas")).toBeNull());
    fireEvent.mouseEnter(screen.getByLabelText("Recent standalone canvases"));
    expect(screen.queryByText("Product Ideas")).toBeNull();
    expect(onOpenCanvas).not.toHaveBeenCalled();
  });
});
