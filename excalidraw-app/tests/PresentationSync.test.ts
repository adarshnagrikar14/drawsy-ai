import { clear, createStore } from "idb-keyval";
import { vi } from "vitest";

import { PresentationApiError } from "../data/PresentationApi";
import {
  PresentationStore,
  type PresentationScene,
} from "../data/PresentationStore";
import { PresentationSync } from "../data/PresentationSync";
import { createPresentationAnimationMetadata } from "../presentation/animations";

import type { PresentationApi } from "../data/PresentationApi";

const store = createStore("drawsy-presentation-db", "presentation-store");

const createScene = (name: string, elementId = "element-1") =>
  ({
    elements: [
      {
        id: elementId,
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        angle: 0,
        strokeColor: "#1e1e1e",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        groupIds: [],
        frameId: null,
        index: "a0",
        roundness: null,
        seed: 1,
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        boundElements: [],
        updated: 1,
        link: null,
        locked: false,
      },
    ],
    appState: { name, viewBackgroundColor: "#ffffff" },
    files: {},
    presentation: createPresentationAnimationMetadata(),
  } as unknown as PresentationScene);

const remoteMetadata = (
  id: string,
  title: string,
  version: number,
  lastOpenedAt: number,
) => ({
  id,
  title,
  version,
  createdAt: 1,
  updatedAt: lastOpenedAt,
  lastOpenedAt,
  contentHash: `${id}-hash-${version}`,
});

const createApi = () => ({
  getPresentations: vi.fn<PresentationApi["getPresentations"]>(() =>
    Promise.resolve({ presentations: [] }),
  ),
  getPresentationScene: vi.fn<PresentationApi["getPresentationScene"]>(() =>
    Promise.resolve(createScene("Remote")),
  ),
  putPresentation: vi.fn<PresentationApi["putPresentation"]>((document) =>
    Promise.resolve({
      id: document.id,
      title: document.title,
      version: document.sync.remoteVersion + 1,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      lastOpenedAt: document.lastOpenedAt,
      contentHash: "saved-hash",
    }),
  ),
  patchPresentation: vi.fn<PresentationApi["patchPresentation"]>((document) =>
    Promise.resolve({
      id: document.id,
      title: document.title,
      version: document.sync.remoteVersion + 1,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      lastOpenedAt: document.lastOpenedAt,
      contentHash: document.sync.remoteContentHash,
    }),
  ),
  deletePresentation: vi.fn<PresentationApi["deletePresentation"]>(() =>
    Promise.resolve(),
  ),
});

describe("PresentationSync", () => {
  beforeEach(async () => {
    await clear(store);
    PresentationStore.setScope(null);
  });

  afterEach(async () => {
    await clear(store);
    PresentationStore.setScope(null);
  });

  it("hydrates only the latest remote presentation during initialization", async () => {
    const api = createApi();
    api.getPresentations.mockResolvedValue({
      presentations: [
        remoteMetadata("presentation-1", "Older", 1, 1),
        remoteMetadata("presentation-2", "Latest", 2, 2),
      ],
    });
    api.getPresentationScene.mockImplementation((id) =>
      Promise.resolve(
        createScene(id === "presentation-2" ? "Latest" : "Older"),
      ),
    );
    const sync = new PresentationSync(api, createScene("Blank"));

    const result = await sync.initialize("user-1", createScene("Blank"));

    expect(result.document.id).toBe("presentation-2");
    expect(api.getPresentationScene).toHaveBeenCalledTimes(1);
    expect(api.getPresentationScene).toHaveBeenCalledWith("presentation-2");
    expect(await PresentationStore.getDocument("presentation-1")).toBeNull();
  });

  it("uploads a local presentation and clears its dirty checkpoint", async () => {
    const api = createApi();
    const sync = new PresentationSync(api, createScene("Blank"));
    const initialized = await sync.initialize(
      "user-2",
      createScene("Local draft"),
    );

    const pushed = await sync.push(initialized.index);

    expect(api.putPresentation).toHaveBeenCalledTimes(1);
    expect(pushed.presentations[0].sync).toEqual({
      remoteVersion: 1,
      remoteContentHash: "saved-hash",
      dirty: false,
      contentDirty: false,
    });
  });

  it("lazily downloads an inactive presentation when it is opened", async () => {
    const api = createApi();
    api.getPresentations.mockResolvedValue({
      presentations: [
        remoteMetadata("presentation-1", "Older", 1, 1),
        remoteMetadata("presentation-2", "Latest", 1, 2),
      ],
    });
    api.getPresentationScene.mockImplementation((id) =>
      Promise.resolve(
        createScene(id === "presentation-1" ? "Older" : "Latest"),
      ),
    );
    const sync = new PresentationSync(api, createScene("Blank"));
    const initialized = await sync.initialize("user-3", createScene("Blank"));
    api.getPresentationScene.mockClear();

    const opened = await sync.openPresentation(
      initialized.index,
      "presentation-1",
    );

    expect(opened?.document.title).toBe("Older");
    expect(api.getPresentationScene).toHaveBeenCalledWith("presentation-1");
    expect(
      await PresentationStore.getDocument("presentation-1"),
    ).not.toBeNull();
  });

  it("keeps a failed cloud checkpoint dirty and available locally", async () => {
    const api = createApi();
    api.putPresentation.mockRejectedValue(
      new PresentationApiError(503, "unavailable", "Offline"),
    );
    const sync = new PresentationSync(api, createScene("Blank"));
    const initialized = await sync.initialize(
      "user-4",
      createScene("Offline draft"),
    );

    await expect(sync.push(initialized.index)).rejects.toThrow("Offline");
    const local = await PresentationStore.getIndex();
    expect(local?.presentations[0].sync.dirty).toBe(true);
    expect(
      await PresentationStore.getDocument(initialized.document.id),
    ).not.toBeNull();
  });
});
