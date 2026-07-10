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

  it("persists an active presentation outside workspace canvases", async () => {
    PresentationStore.saveActive(true);
    expect(PresentationStore.loadActive()).toBe(true);

    const scene = createScene();
    const created = await PresentationStore.initialize(scene);
    await PresentationStore.flushSave(created.document.id, scene);

    const restored = await PresentationStore.openPresentation(
      created.index,
      created.document.id,
    );
    expect(restored?.document.scene.elements).toHaveLength(1);
    expect(restored?.document.scene.appState?.name).toBe("Draft title");
    expect(restored?.document.scene.appState?.viewBackgroundColor).toBe(
      "#ffffff",
    );
    expect(restored?.document.scene.presentation).toEqual(
      createPresentationAnimationMetadata(),
    );
  });

  it("keeps independent documents for multiple presentations", async () => {
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
    const first = await PresentationStore.initialize(scene);
    const secondScene = {
      ...createScene(),
      appState: { name: "Q2 review" },
    };
    const second = await PresentationStore.createPresentation(
      first.index,
      secondScene,
    );

    expect(second.index.presentations).toHaveLength(2);
    expect(second.document.scene.appState?.name).toBe("Q2 review");

    const renamedIndex = await PresentationStore.renamePresentation(
      second.index,
      first.document.id,
      "Opening",
    );
    const reopened = await PresentationStore.openPresentation(
      renamedIndex,
      first.document.id,
    );

    expect(reopened?.document.title).toBe("Opening");
    expect(reopened?.document.scene.presentation).toEqual(scene.presentation);

    const afterDelete = await PresentationStore.deletePresentation(
      reopened!.index,
      second.document.id,
      createScene(),
    );
    expect(afterDelete?.index.presentations).toHaveLength(1);
    expect(afterDelete?.document.id).toBe(first.document.id);
  });

  it("migrates the legacy single presentation into the indexed store", async () => {
    const scene = createScene();
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

    const migrated = await PresentationStore.initialize(createScene());
    expect(migrated.index.presentations).toHaveLength(1);
    expect(migrated.document.title).toBe("Presentation");
    expect(migrated.document.scene.presentation).toEqual(
      createPresentationAnimationMetadata(),
    );
  });
});
