import { clear, createStore, del } from "idb-keyval";

import { WorkspaceStore, type CanvasScene } from "../data/WorkspaceStore";

const store = createStore("drawsy-workspace-db", "workspace-store");

const createScene = (name: string): CanvasScene => ({
  elements: [],
  appState: { name },
  files: {},
});

describe("WorkspaceStore", () => {
  beforeEach(async () => {
    await clear(store);
  });

  afterEach(async () => {
    await clear(store);
  });

  it("recovers a valid canvas and prunes orphan references", async () => {
    const initial = await WorkspaceStore.initialize(createScene("Original"));
    const withProject = await WorkspaceStore.createProject(
      initial.index,
      createScene("Project canvas"),
    );
    const missingCanvasId = withProject.document.id;
    const projectId = withProject.document.projectId!;

    await del(`canvas:${missingCanvasId}`, store);

    const recovered = await WorkspaceStore.initialize(createScene("Fallback"));

    expect(recovered.document.id).toBe(initial.document.id);
    expect(recovered.index.activeCanvasId).toBe(initial.document.id);
    expect(recovered.index.canvases.map((canvas) => canvas.id)).toEqual([
      initial.document.id,
    ]);
    expect(
      recovered.index.projects.find((project) => project.id === projectId)
        ?.canvasIds,
    ).toEqual([]);
  });
});
