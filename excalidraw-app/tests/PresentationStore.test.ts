import { clear, createStore, set } from "idb-keyval";

import {
  PresentationStore,
  type PresentationScene,
} from "../data/PresentationStore";
import { createPresentationAnimationMetadata } from "../presentation/animations";

const store = createStore("drawsy-presentation-db", "presentation-store");

const createScene = (): PresentationScene =>
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
    presentation: createPresentationAnimationMetadata(),
  } as unknown as PresentationScene);

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
    expect(restored?.presentation).toEqual(
      createPresentationAnimationMetadata(),
    );
  });

  it("retains animation metadata and gives legacy scenes an empty animation layer", async () => {
    const scene = createScene();
    scene.presentation = {
      version: 1,
      builds: [
        {
          id: "build-1",
          frameId: "frame-1",
          targetIds: ["presentation-element"],
          effect: "fade",
          trigger: "on-click",
          direction: "left",
        },
      ],
      transitions: { "frame-1": "fade" },
    };
    await PresentationStore.flushSave(scene);

    expect((await PresentationStore.loadScene())?.presentation).toEqual(
      scene.presentation,
    );

    await set(
      "presentation-document",
      {
        schemaVersion: 1,
        title: "Presentation",
        scene: {
          elements: scene.elements,
          appState: scene.appState,
          files: scene.files,
        },
        updatedAt: 1,
      },
      store,
    );

    expect((await PresentationStore.loadScene())?.presentation).toEqual(
      createPresentationAnimationMetadata(),
    );
  });
});
