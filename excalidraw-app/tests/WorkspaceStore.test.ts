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
    WorkspaceStore.setScope(null);
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

    await del(`canvas:guest:${missingCanvasId}`, store);

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

  it("imports a shared scene as a new active standalone canvas", async () => {
    await WorkspaceStore.initialize(createScene("Original"));

    const imported = await WorkspaceStore.importCanvas(
      createScene("Shared drawing"),
    );

    expect(imported.document.title).toBe("Shared drawing");
    expect(imported.document.projectId).toBeNull();
    expect(imported.index.activeCanvasId).toBe(imported.document.id);
    expect(imported.index.canvases.map((canvas) => canvas.title)).toEqual([
      "Original",
      "Shared drawing",
    ]);
  });

  it("uses an imported scene as the first canvas in a new workspace", async () => {
    const imported = await WorkspaceStore.importCanvas(
      createScene("Shared drawing"),
    );

    expect(imported.index.canvases).toHaveLength(1);
    expect(imported.index.activeCanvasId).toBe(imported.document.id);
    expect(imported.document.title).toBe("Shared drawing");
  });

  it("gives repeated shared imports unique synchronized titles", async () => {
    await WorkspaceStore.initialize(createScene("Shared drawing"));

    const second = await WorkspaceStore.importCanvas(
      createScene("Shared drawing"),
    );
    const third = await WorkspaceStore.importCanvas(
      createScene("Shared drawing"),
    );

    expect(second.document.title).toBe("Shared drawing (2)");
    expect(second.document.scene.appState?.name).toBe("Shared drawing (2)");
    expect(third.document.title).toBe("Shared drawing (3)");
    expect(third.document.scene.appState?.name).toBe("Shared drawing (3)");
  });

  it("deletes a project and every canvas it contains", async () => {
    const initial = await WorkspaceStore.initialize(createScene("Original"));
    const project = await WorkspaceStore.createProject(
      initial.index,
      createScene("Project canvas"),
    );
    const projectId = project.document.projectId!;
    const secondProjectCanvas = await WorkspaceStore.createCanvas(
      project.index,
      createScene("Second project canvas"),
      projectId,
    );

    const deleted = await WorkspaceStore.deleteProject(
      secondProjectCanvas.index,
      projectId,
      createScene("Replacement"),
    );

    expect(deleted?.index.projects).toHaveLength(0);
    expect(deleted?.index.canvases.map((canvas) => canvas.title)).toEqual([
      "Original",
    ]);
    expect(deleted?.document?.id).toBe(initial.document.id);
    expect(
      await WorkspaceStore.openCanvas(deleted!.index, project.document.id),
    ).toBeNull();
    expect(
      await WorkspaceStore.openCanvas(
        deleted!.index,
        secondProjectCanvas.document.id,
      ),
    ).toBeNull();
  });

  it("creates a blank replacement after deleting the final canvas", async () => {
    const initial = await WorkspaceStore.initialize(createScene("Only canvas"));

    const deleted = await WorkspaceStore.deleteCanvas(
      initial.index,
      initial.document.id,
      createScene("Untitled"),
    );

    expect(deleted?.index.canvases).toHaveLength(1);
    expect(deleted?.document?.title).toBe("Untitled");
    expect(deleted?.document?.id).not.toBe(initial.document.id);
    expect(deleted?.index.activeCanvasId).toBe(deleted?.document?.id);
  });

  it("isolates authenticated caches and seeds the first account from guest data", async () => {
    const guest = await WorkspaceStore.initialize(createScene("Guest canvas"));

    WorkspaceStore.setScope("user-1");
    const seeded = await WorkspaceStore.seedFromGuest();
    const account = await WorkspaceStore.initialize(createScene("Ignored"));
    const withSecondCanvas = await WorkspaceStore.createCanvas(
      account.index,
      createScene("Account canvas"),
    );

    expect(seeded?.activeCanvasId).toBe(guest.document.id);
    expect(account.document.title).toBe("Guest canvas");
    expect(withSecondCanvas.index.canvases).toHaveLength(2);

    WorkspaceStore.setScope(null);
    const restoredGuest = await WorkspaceStore.initialize(
      createScene("Fallback"),
    );
    expect(restoredGuest.index.canvases).toHaveLength(1);
    expect(restoredGuest.document.title).toBe("Guest canvas");
  });

  it("persists remote versions after a canvas is synchronized", async () => {
    const workspace = await WorkspaceStore.initialize(createScene("Canvas"));

    const synced = await WorkspaceStore.markCanvasSynced(
      workspace.index,
      workspace.document.id,
      4,
    );
    const document = await WorkspaceStore.getDocument(workspace.document.id);

    expect(synced.canvases[0].sync).toEqual({
      remoteVersion: 4,
      dirty: false,
    });
    expect(document?.sync).toEqual({ remoteVersion: 4, dirty: false });
  });
});
