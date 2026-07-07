import { clear, createStore } from "idb-keyval";

import { PresentationStore } from "../data/PresentationStore";

import type { CanvasScene } from "../data/WorkspaceStore";

const store = createStore("drawsy-presentation-db", "presentation-store");

const createScene = (): CanvasScene =>
  ({
    elements: [
      {
        id: "presentation-element",
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
    appState: { name: "Draft title", viewBackgroundColor: "#ffffff" },
    files: {},
  } as unknown as CanvasScene);

describe("PresentationStore", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await clear(store);
  });

  afterEach(async () => {
    window.localStorage.clear();
    await clear(store);
  });

  it("persists active state and scene outside workspace canvases", async () => {
    PresentationStore.saveActive(true);
    expect(PresentationStore.loadActive()).toBe(true);

    const scene = createScene();
    await PresentationStore.flushSave(scene);

    const restored = await PresentationStore.loadScene();
    expect(restored?.elements).toHaveLength(1);
    expect(restored?.appState?.name).toBe("Presentation");
    expect(restored?.appState?.viewBackgroundColor).toBe("#ffffff");
  });
});
