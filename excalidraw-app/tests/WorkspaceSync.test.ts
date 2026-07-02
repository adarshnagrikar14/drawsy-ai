import { clear, createStore } from "idb-keyval";

import { WorkspaceStore, type CanvasScene } from "../data/WorkspaceStore";
import { WorkspaceSync } from "../data/WorkspaceSync";

import type { RemoteWorkspace } from "../data/WorkspaceApi";

const store = createStore("drawsy-workspace-db", "workspace-store");

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
  getCanvasScene: vi.fn(() => Promise.resolve(createScene("Remote"))),
  putProject: vi.fn((project) =>
    Promise.resolve({ ...project, version: project.sync.remoteVersion + 1 }),
  ),
  putCanvas: vi.fn((document) =>
    Promise.resolve({ ...document, version: document.sync.remoteVersion + 1 }),
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
    expect(api.putCanvas).toHaveBeenCalledTimes(1);
    expect(workspace.index.canvases[0].sync).toEqual({
      remoteVersion: 1,
      dirty: false,
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
      dirty: false,
    });
    expect(api.putCanvas).not.toHaveBeenCalled();
  });

  it("pushes dirty local edits when the remote version is unchanged", async () => {
    WorkspaceStore.setScope("user-3");
    const initial = await WorkspaceStore.initialize(createScene("Original"));
    const syncedIndex = await WorkspaceStore.markCanvasSynced(
      initial.index,
      initial.document.id,
      1,
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
          createdAt: metadata.createdAt,
          updatedAt: metadata.updatedAt,
          lastOpenedAt: metadata.lastOpenedAt,
        },
      ],
    });
    const sync = new WorkspaceSync(api);

    const workspace = await sync.initialize("user-3", createScene("Ignored"));

    expect(api.getCanvasScene).not.toHaveBeenCalled();
    expect(api.putCanvas).toHaveBeenCalledWith(
      expect.objectContaining({
        scene: expect.objectContaining({
          appState: expect.objectContaining({ name: "Local edit" }),
        }),
      }),
    );
    expect(workspace.index.canvases[0].sync).toEqual({
      remoteVersion: 2,
      dirty: false,
    });
  });

  it("preserves local edits as a conflict copy when the remote also changed", async () => {
    WorkspaceStore.setScope("user-4");
    const initial = await WorkspaceStore.initialize(createScene("Original"));
    const syncedIndex = await WorkspaceStore.markCanvasSynced(
      initial.index,
      initial.document.id,
      1,
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
    expect(api.putCanvas).toHaveBeenCalledTimes(1);
    expect(api.putCanvas).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Local edit (conflict)" }),
    );
  });
});
