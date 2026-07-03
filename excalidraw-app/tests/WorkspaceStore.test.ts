import { clear, createStore, del, set } from "idb-keyval";

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

  it("migrates existing workspaces to content-aware sync state", async () => {
    const metadata = {
      id: "legacy-canvas",
      title: "Legacy",
      projectId: null,
      version: 2,
      createdAt: 1,
      updatedAt: 2,
      lastOpenedAt: 2,
      sync: { remoteVersion: 4, dirty: false },
    };
    await set(
      "workspace-index:guest",
      {
        schemaVersion: 2,
        activeCanvasId: metadata.id,
        canvases: [metadata],
        projects: [],
        pendingDeletes: [],
      },
      store,
    );
    await set(
      `canvas:guest:${metadata.id}`,
      { ...metadata, scene: createScene("Legacy") },
      store,
    );

    const migrated = await WorkspaceStore.initialize(createScene("Ignored"));

    expect(migrated.index.schemaVersion).toBe(3);
    expect(migrated.index.canvases[0].sync).toEqual({
      remoteVersion: 4,
      remoteContentHash: null,
      dirty: false,
      contentDirty: false,
    });
  });

  it("recovers a document written before its index update", async () => {
    const initial = await WorkspaceStore.initialize(createScene("Original"));
    const metadata = initial.index.canvases[0];
    const recoveredMetadata = {
      ...metadata,
      title: "Recovered edit",
      version: metadata.version + 1,
      updatedAt: metadata.updatedAt + 1,
      sync: {
        ...metadata.sync,
        dirty: true,
        contentDirty: true,
      },
    };
    await set(
      `canvas:guest:${metadata.id}`,
      {
        ...recoveredMetadata,
        scene: createScene("Recovered edit"),
      },
      store,
    );

    const recovered = await WorkspaceStore.initialize(createScene("Ignored"));

    expect(recovered.document.title).toBe("Recovered edit");
    expect(recovered.index.canvases[0]).toEqual(recoveredMetadata);
    expect(recovered.index.canvases[0].sync.contentDirty).toBe(true);
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
    expect(secondProjectCanvas).not.toBeNull();

    const deleted = await WorkspaceStore.deleteProject(
      secondProjectCanvas!.index,
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
        secondProjectCanvas!.document.id,
      ),
    ).toBeNull();
  });

  it("queues synced child canvases when deleting an unsynced project", async () => {
    const initial = await WorkspaceStore.initialize(createScene("Original"));
    const project = await WorkspaceStore.createProject(
      initial.index,
      createScene("Project canvas"),
    );
    const projectId = project.document.projectId!;
    const inconsistentIndex = await WorkspaceStore.markCanvasSynced(
      project.index,
      project.document.id,
      3,
      "a".repeat(64),
      project.document.version,
    );

    const deleted = await WorkspaceStore.deleteProject(
      inconsistentIndex,
      projectId,
      createScene("Replacement"),
    );

    expect(deleted?.index.pendingDeletes).toContainEqual({
      type: "canvas",
      id: project.document.id,
      remoteVersion: 3,
    });
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
      "a".repeat(64),
      workspace.document.version,
    );
    const document = await WorkspaceStore.getDocument(workspace.document.id);

    expect(synced.canvases[0].sync).toEqual({
      remoteVersion: 4,
      remoteContentHash: "a".repeat(64),
      dirty: false,
      contentDirty: false,
    });
    expect(document?.sync).toEqual({
      remoteVersion: 4,
      remoteContentHash: "a".repeat(64),
      dirty: false,
      contentDirty: false,
    });
  });

  it("does not mark canvas content dirty when it is only opened", async () => {
    const workspace = await WorkspaceStore.initialize(createScene("Canvas"));
    const synced = await WorkspaceStore.markCanvasSynced(
      workspace.index,
      workspace.document.id,
      4,
      "a".repeat(64),
      workspace.document.version,
    );

    const opened = await WorkspaceStore.openCanvas(
      synced,
      workspace.document.id,
    );

    expect(opened?.index.canvases[0].sync).toEqual({
      remoteVersion: 4,
      remoteContentHash: "a".repeat(64),
      dirty: true,
      contentDirty: false,
    });
    expect(opened?.document.sync).toEqual({
      remoteVersion: 4,
      remoteContentHash: "a".repeat(64),
      dirty: true,
      contentDirty: false,
    });
  });

  it("preserves both edits when two tabs save stale versions", async () => {
    const initial = await WorkspaceStore.initialize(createScene("Original"));
    const firstTab = await WorkspaceStore.saveCanvas(
      initial.index,
      initial.document.id,
      createScene("First tab") as Parameters<
        typeof WorkspaceStore.saveCanvas
      >[2],
    );

    const secondTab = await WorkspaceStore.saveCanvas(
      initial.index,
      initial.document.id,
      createScene("Second tab") as Parameters<
        typeof WorkspaceStore.saveCanvas
      >[2],
    );

    expect(secondTab.canvases).toHaveLength(2);
    expect(secondTab.canvases.map((canvas) => canvas.title).sort()).toEqual([
      "First tab",
      "Second tab (conflict)",
    ]);
    expect(secondTab.activeCanvasId).not.toBe(firstTab.activeCanvasId);
    expect(
      await WorkspaceStore.getDocument(secondTab.activeCanvasId),
    ).toMatchObject({ title: "Second tab (conflict)" });
  });

  it("keeps edits dirty when they change during an in-flight sync", async () => {
    const initial = await WorkspaceStore.initialize(createScene("Original"));
    const sent = await WorkspaceStore.saveCanvas(
      initial.index,
      initial.document.id,
      createScene("Sent") as Parameters<typeof WorkspaceStore.saveCanvas>[2],
    );
    await WorkspaceStore.saveCanvas(
      sent,
      initial.document.id,
      createScene("Changed again") as Parameters<
        typeof WorkspaceStore.saveCanvas
      >[2],
    );

    const acknowledged = await WorkspaceStore.markCanvasSynced(
      sent,
      initial.document.id,
      1,
      "a".repeat(64),
      sent.canvases[0].version,
    );

    expect(acknowledged.canvases[0].title).toBe("Changed again");
    expect(acknowledged.canvases[0].sync).toEqual({
      remoteVersion: 1,
      remoteContentHash: "a".repeat(64),
      dirty: true,
      contentDirty: true,
    });
  });

  it("does not create a canvas in a project deleted by another tab", async () => {
    const initial = await WorkspaceStore.initialize(createScene("Original"));
    const project = await WorkspaceStore.createProject(
      initial.index,
      createScene("Project canvas"),
    );
    const projectId = project!.document.projectId!;
    await WorkspaceStore.deleteProject(
      project!.index,
      projectId,
      createScene("Replacement"),
    );

    const created = await WorkspaceStore.createCanvas(
      project!.index,
      createScene("Stale project canvas"),
      projectId,
    );

    expect(created).toBeNull();
    expect(
      (await WorkspaceStore.getIndex())?.canvases.some(
        (canvas) => canvas.projectId === projectId,
      ),
    ).toBe(false);
  });
});
