import { clear, createStore } from "idb-keyval";

import { WorkspaceStore, type CanvasScene } from "../data/WorkspaceStore";
import { WorkspaceSync } from "../data/WorkspaceSync";
import { WorkspaceApiError } from "../data/WorkspaceApi";

import type { RemoteWorkspace } from "../data/WorkspaceApi";

const store = createStore("drawsy-workspace-db", "workspace-store");
const REMOTE_HASH = "a".repeat(64);

const createScene = (name: string): CanvasScene => ({
  elements: [],
  appState: { name },
  files: {},
});

const createApi = () => ({
  getWorkspace: vi.fn(
    (): Promise<RemoteWorkspace> =>
      Promise.resolve({ projects: [], canvases: [] }),
  ),
  getCanvasScene: vi.fn((_canvasId?: string) =>
    Promise.resolve(createScene("Remote")),
  ),
  putProject: vi.fn((project) =>
    Promise.resolve({ ...project, version: project.sync.remoteVersion + 1 }),
  ),
  putCanvas: vi.fn((document) =>
    Promise.resolve({
      ...document,
      version: document.sync.remoteVersion + 1,
      contentHash: REMOTE_HASH,
    }),
  ),
  patchCanvas: vi.fn((document) =>
    Promise.resolve({
      ...document,
      version: document.sync.remoteVersion + 1,
      contentHash: document.sync.remoteContentHash,
    }),
  ),
  deleteProject: vi.fn(() => Promise.resolve({ deletedCanvasIds: [] })),
  deleteCanvas: vi.fn(() => Promise.resolve()),
});

describe("WorkspaceSync", () => {
  beforeEach(async () => {
    await clear(store);
    WorkspaceStore.setScope(null);
  });

  afterEach(async () => {
    await clear(store);
  });

  it("seeds a first authenticated workspace from guest canvases", async () => {
    await WorkspaceStore.initialize(createScene("Guest canvas"));
    const api = createApi();
    const sync = new WorkspaceSync(api);

    const workspace = await sync.initialize("user-1", createScene("Current"));

    expect(workspace.document.title).toBe("Guest canvas");
    expect(api.putCanvas).not.toHaveBeenCalled();

    const syncedIndex = await sync.push(workspace.index);

    expect(api.putCanvas).toHaveBeenCalledTimes(1);
    expect(syncedIndex.canvases[0].sync).toEqual({
      remoteVersion: 1,
      remoteContentHash: REMOTE_HASH,
      dirty: false,
      contentDirty: false,
    });
  });

  it("hydrates an empty device cache from the remote workspace", async () => {
    const api = createApi();
    api.getWorkspace.mockResolvedValue({
      projects: [],
      canvases: [
        {
          id: "remote-canvas",
          title: "Remote canvas",
          projectId: null,
          version: 3,
          contentHash: REMOTE_HASH,
          createdAt: 1,
          updatedAt: 2,
          lastOpenedAt: 3,
        },
      ],
    });
    const sync = new WorkspaceSync(api);

    const workspace = await sync.initialize("user-2", createScene("Current"));

    expect(api.getCanvasScene).toHaveBeenCalledWith("remote-canvas");
    expect(workspace.document.title).toBe("Remote canvas");
    expect(workspace.index.canvases[0].sync).toEqual({
      remoteVersion: 3,
      remoteContentHash: REMOTE_HASH,
      dirty: false,
      contentDirty: false,
    });
    expect(api.putCanvas).not.toHaveBeenCalled();
  });

  it("hydrates only the active scene and lazily caches other canvases", async () => {
    const api = createApi();
    api.getWorkspace.mockResolvedValue({
      projects: [],
      canvases: [
        {
          id: "older-canvas",
          title: "Older",
          projectId: null,
          version: 1,
          contentHash: "b".repeat(64),
          createdAt: 1,
          updatedAt: 1,
          lastOpenedAt: 1,
        },
        {
          id: "recent-canvas",
          title: "Recent",
          projectId: null,
          version: 1,
          contentHash: REMOTE_HASH,
          createdAt: 1,
          updatedAt: 2,
          lastOpenedAt: 2,
        },
      ],
    });
    api.getCanvasScene.mockImplementation((canvasId?: string) =>
      Promise.resolve(createScene(canvasId || "Remote")),
    );
    const sync = new WorkspaceSync(api);

    const workspace = await sync.initialize(
      "user-lazy",
      createScene("Ignored"),
    );

    expect(workspace.document.id).toBe("recent-canvas");
    expect(api.getCanvasScene).toHaveBeenCalledTimes(1);
    expect(api.getCanvasScene).toHaveBeenCalledWith("recent-canvas");
    expect(await WorkspaceStore.getDocument("older-canvas")).toBeUndefined();

    const opened = await sync.openCanvas(workspace.index, "older-canvas");
    expect(opened?.document.id).toBe("older-canvas");
    expect(api.getCanvasScene).toHaveBeenCalledWith("older-canvas");
    expect(await WorkspaceStore.getDocument("older-canvas")).toBeDefined();
  });

  it("removes a lazily listed canvas when it was deleted before opening", async () => {
    const api = createApi();
    const recent = {
      id: "recent-canvas",
      title: "Recent",
      projectId: null,
      version: 1,
      contentHash: REMOTE_HASH,
      createdAt: 1,
      updatedAt: 2,
      lastOpenedAt: 2,
    };
    const removed = {
      ...recent,
      id: "removed-canvas",
      title: "Removed",
      contentHash: "b".repeat(64),
      lastOpenedAt: 1,
    };
    api.getWorkspace.mockResolvedValue({
      projects: [],
      canvases: [removed, recent],
    });
    const sync = new WorkspaceSync(api);
    const workspace = await sync.initialize(
      "user-stale",
      createScene("Ignored"),
    );
    api.getWorkspace.mockResolvedValue({ projects: [], canvases: [recent] });
    api.getCanvasScene.mockRejectedValueOnce(
      new WorkspaceApiError(404, "scene_not_found", "Not found"),
    );

    const opened = await sync.openCanvas(workspace.index, removed.id);

    expect(opened?.document.id).toBe(recent.id);
    expect(opened?.index.canvases.map((canvas) => canvas.id)).toEqual([
      recent.id,
    ]);
  });

  it("pushes dirty local edits when the remote version is unchanged", async () => {
    WorkspaceStore.setScope("user-3");
    const initial = await WorkspaceStore.initialize(createScene("Original"));
    const syncedIndex = await WorkspaceStore.markCanvasSynced(
      initial.index,
      initial.document.id,
      1,
      REMOTE_HASH,
      initial.document.version,
    );
    const dirtyIndex = await WorkspaceStore.saveCanvas(
      syncedIndex,
      initial.document.id,
      createScene("Local edit") as Parameters<
        typeof WorkspaceStore.saveCanvas
      >[2],
    );
    const metadata = dirtyIndex.canvases[0];
    const api = createApi();
    api.getWorkspace.mockResolvedValue({
      projects: [],
      canvases: [
        {
          id: metadata.id,
          title: "Original",
          projectId: null,
          version: 1,
          contentHash: REMOTE_HASH,
          createdAt: metadata.createdAt,
          updatedAt: metadata.updatedAt,
          lastOpenedAt: metadata.lastOpenedAt,
        },
      ],
    });
    const sync = new WorkspaceSync(api);

    const workspace = await sync.initialize("user-3", createScene("Ignored"));
    const pushed = await sync.push(workspace.index);

    expect(api.getCanvasScene).not.toHaveBeenCalled();
    expect(api.putCanvas).toHaveBeenCalledWith(
      expect.objectContaining({
        scene: expect.objectContaining({
          appState: expect.objectContaining({ name: "Local edit" }),
        }),
      }),
    );
    expect(pushed.canvases[0].sync).toEqual({
      remoteVersion: 2,
      remoteContentHash: REMOTE_HASH,
      dirty: false,
      contentDirty: false,
    });
  });

  it("preserves local edits as a conflict copy when the remote also changed", async () => {
    WorkspaceStore.setScope("user-4");
    const initial = await WorkspaceStore.initialize(createScene("Original"));
    const syncedIndex = await WorkspaceStore.markCanvasSynced(
      initial.index,
      initial.document.id,
      1,
      REMOTE_HASH,
      initial.document.version,
    );
    await WorkspaceStore.saveCanvas(
      syncedIndex,
      initial.document.id,
      createScene("Local edit") as Parameters<
        typeof WorkspaceStore.saveCanvas
      >[2],
    );
    const api = createApi();
    api.getWorkspace.mockResolvedValue({
      projects: [],
      canvases: [
        {
          id: initial.document.id,
          title: "Remote edit",
          projectId: null,
          version: 2,
          contentHash: "b".repeat(64),
          createdAt: 1,
          updatedAt: 3,
          lastOpenedAt: 3,
        },
      ],
    });
    api.getCanvasScene.mockResolvedValue(createScene("Remote edit"));
    const sync = new WorkspaceSync(api);

    const workspace = await sync.initialize("user-4", createScene("Ignored"));

    expect(
      workspace.index.canvases.map((canvas) => canvas.title).sort(),
    ).toEqual(["Local edit (conflict)", "Remote edit"]);
    expect(workspace.document.title).toBe("Local edit (conflict)");
    expect(workspace.document.scene.appState?.name).toBe(
      "Local edit (conflict)",
    );
    expect(api.putCanvas).not.toHaveBeenCalled();

    await sync.push(workspace.index);

    expect(api.putCanvas).toHaveBeenCalledTimes(1);
    expect(api.putCanvas).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Local edit (conflict)" }),
    );
  });

  it("does not create a conflict copy when only remote metadata changed", async () => {
    WorkspaceStore.setScope("user-5");
    const initial = await WorkspaceStore.initialize(createScene("Same scene"));
    const syncedIndex = await WorkspaceStore.markCanvasSynced(
      initial.index,
      initial.document.id,
      1,
      REMOTE_HASH,
      initial.document.version,
    );
    await WorkspaceStore.openCanvas(syncedIndex, initial.document.id);
    const api = createApi();
    api.getWorkspace.mockResolvedValue({
      projects: [],
      canvases: [
        {
          id: initial.document.id,
          title: "Same scene",
          projectId: null,
          version: 2,
          contentHash: REMOTE_HASH,
          createdAt: 1,
          updatedAt: 3,
          lastOpenedAt: 3,
        },
      ],
    });
    api.getCanvasScene.mockResolvedValue(createScene("Same scene"));

    const sync = new WorkspaceSync(api);
    const workspace = await sync.initialize("user-5", createScene("Ignored"));
    const pushed = await sync.push(workspace.index);

    expect(workspace.index.canvases).toHaveLength(1);
    expect(workspace.index.canvases[0].title).toBe("Same scene");
    expect(pushed.canvases[0].sync).toEqual({
      remoteVersion: 2,
      remoteContentHash: REMOTE_HASH,
      dirty: false,
      contentDirty: false,
    });
    expect(api.putCanvas).not.toHaveBeenCalled();
    expect(api.patchCanvas).toHaveBeenCalledTimes(1);
    expect(api.getCanvasScene).not.toHaveBeenCalled();
  });

  it("performs a two-way reconciliation for an explicit sync", async () => {
    WorkspaceStore.setScope("user-manual");
    const initial = await WorkspaceStore.initialize(createScene("Original"));
    const syncedIndex = await WorkspaceStore.markCanvasSynced(
      initial.index,
      initial.document.id,
      1,
      REMOTE_HASH,
      initial.document.version,
    );
    const api = createApi();
    api.getWorkspace.mockResolvedValue({
      projects: [],
      canvases: [
        {
          id: initial.document.id,
          title: "Remote edit",
          projectId: null,
          version: 2,
          contentHash: "b".repeat(64),
          createdAt: 1,
          updatedAt: 3,
          lastOpenedAt: 3,
        },
      ],
    });
    api.getCanvasScene.mockResolvedValue(createScene("Remote edit"));
    const sync = new WorkspaceSync(api);
    const result = await sync.synchronize(syncedIndex);

    expect(result.document?.title).toBe("Remote edit");
    expect(result.index.canvases).toHaveLength(1);
    expect(api.getWorkspace).toHaveBeenCalledTimes(1);
    expect(api.putCanvas).not.toHaveBeenCalled();
  });

  it("keeps a failed cloud checkpoint safely queued in local storage", async () => {
    const api = createApi();
    api.putCanvas.mockRejectedValue(new Error("offline"));
    const sync = new WorkspaceSync(api);

    const workspace = await sync.initialize(
      "user-6",
      createScene("Offline edit"),
    );
    await expect(sync.push(workspace.index)).rejects.toThrow("offline");

    const local = await WorkspaceStore.getIndex();
    expect(local?.canvases[0].title).toBe("Offline edit");
    expect(local?.canvases[0].sync).toMatchObject({
      remoteVersion: 0,
      dirty: true,
      contentDirty: true,
    });
  });

  it("honors remote deletion instead of resurrecting a synced canvas", async () => {
    WorkspaceStore.setScope("user-delete");
    const initial = await WorkspaceStore.initialize(createScene("Deleted"));
    await WorkspaceStore.markCanvasSynced(
      initial.index,
      initial.document.id,
      3,
      REMOTE_HASH,
      initial.document.version,
    );
    const api = createApi();
    const sync = new WorkspaceSync(api);

    const workspace = await sync.initialize(
      "user-delete",
      createScene("Old editor state"),
    );

    expect(workspace.index.canvases).toHaveLength(1);
    expect(workspace.document.title).toBe("Untitled");
    expect(workspace.document.id).not.toBe(initial.document.id);
    expect(
      await WorkspaceStore.getDocument(initial.document.id),
    ).toBeUndefined();
    expect(api.putCanvas).not.toHaveBeenCalled();

    await sync.push(workspace.index);

    expect(api.putCanvas).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Untitled" }),
    );
  });
});
