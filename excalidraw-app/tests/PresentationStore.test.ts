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
    PresentationStore.setScope(null);
  });

  afterEach(async () => {
    window.localStorage.clear();
    await clear(store);
    PresentationStore.setScope(null);
  });

  it("persists an active presentation outside workspace canvases", async () => {
    PresentationStore.saveActive(true);
    expect(PresentationStore.loadActive()).toBe(true);

    const scene = createScene();
    const created = await PresentationStore.initialize(scene);
    await PresentationStore.savePresentation(
      created.index,
      created.document.id,
      scene,
    );

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

  it("migrates every presentation from the existing indexed store", async () => {
    const scene = createScene();
    const metadata = {
      id: "legacy-presentation",
      title: "Launch plan",
      createdAt: 1,
      updatedAt: 2,
      lastOpenedAt: 3,
    };
    await set(
      "presentation-index",
      {
        schemaVersion: 1,
        activePresentationId: metadata.id,
        presentations: [metadata],
      },
      store,
    );
    await set(
      `presentation-document:${metadata.id}`,
      {
        ...metadata,
        schemaVersion: 3,
        scene: {
          elements: scene.elements,
          appState: scene.appState,
          files: scene.files,
        },
        presentation: scene.presentation,
      },
      store,
    );

    const migrated = await PresentationStore.initialize(createScene());

    expect(migrated.document.id).toBe(metadata.id);
    expect(migrated.document.title).toBe("Launch plan");
    expect(migrated.document.scene.elements).toHaveLength(1);
    expect(migrated.document.sync).toMatchObject({
      remoteVersion: 0,
      dirty: true,
      contentDirty: true,
    });
  });

  it("seeds a signed-in scope directly from the existing indexed store", async () => {
    const scene = createScene();
    const metadata = {
      id: "signed-in-legacy-presentation",
      title: "Existing deck",
      createdAt: 1,
      updatedAt: 2,
      lastOpenedAt: 3,
    };
    await set(
      "presentation-index",
      {
        schemaVersion: 1,
        activePresentationId: metadata.id,
        presentations: [metadata],
      },
      store,
    );
    await set(
      `presentation-document:${metadata.id}`,
      {
        ...metadata,
        schemaVersion: 3,
        scene: {
          elements: scene.elements,
          appState: scene.appState,
          files: scene.files,
        },
        presentation: scene.presentation,
      },
      store,
    );
    PresentationStore.setScope("user-1");

    const seeded = await PresentationStore.seedFromGuest();

    expect(seeded?.document.id).toBe(metadata.id);
    expect(seeded?.document.title).toBe("Existing deck");
    expect(seeded?.index.presentations).toHaveLength(1);
  });

  it("isolates account caches and seeds a first account from guest data", async () => {
    const guest = await PresentationStore.initialize(createScene());
    const guestId = guest.document.id;

    PresentationStore.setScope("user-1");
    expect(await PresentationStore.hasPresentations()).toBe(false);
    const seeded = await PresentationStore.seedFromGuest();
    expect(seeded?.document.id).toBe(guestId);
    expect(seeded?.document.sync).toMatchObject({
      remoteVersion: 0,
      dirty: true,
      contentDirty: true,
    });

    PresentationStore.setScope("user-2");
    expect(await PresentationStore.hasPresentations()).toBe(false);

    PresentationStore.setScope(null);
    expect((await PresentationStore.getIndex())?.activePresentationId).toBe(
      guestId,
    );
  });

  it("queues a remote tombstone before deleting a synchronized presentation", async () => {
    const created = await PresentationStore.initialize(createScene());
    const synced = await PresentationStore.markSynced(
      created.index,
      created.document.id,
      3,
      "remote-hash",
      created.document.version,
    );
    const second = await PresentationStore.createPresentation(
      synced,
      createScene(),
    );

    const deleted = await PresentationStore.deletePresentation(
      second.index,
      created.document.id,
      createScene(),
    );

    expect(deleted?.index.pendingDeletes).toEqual([
      { id: created.document.id, remoteVersion: 3 },
    ]);
    expect(await PresentationStore.getDocument(created.document.id)).toBeNull();
  });

  it("tombstones an upload that completes after local deletion", async () => {
    const created = await PresentationStore.initialize(createScene());
    const second = await PresentationStore.createPresentation(
      created.index,
      createScene(),
    );
    const deleted = await PresentationStore.deletePresentation(
      second.index,
      created.document.id,
      createScene(),
    );
    expect(deleted?.index.pendingDeletes).toEqual([]);

    const acknowledgedUpload = await PresentationStore.markSynced(
      deleted!.index,
      created.document.id,
      1,
      "uploaded-hash",
      created.document.version,
    );

    expect(acknowledgedUpload.pendingDeletes).toEqual([
      { id: created.document.id, remoteVersion: 1 },
    ]);
    expect(
      acknowledgedUpload.presentations.some(
        (presentation) => presentation.id === created.document.id,
      ),
    ).toBe(false);
  });

  it("preserves a local content edit as a conflict copy", async () => {
    const created = await PresentationStore.initialize(createScene());
    const synced = await PresentationStore.markSynced(
      created.index,
      created.document.id,
      1,
      "hash-1",
      created.document.version,
    );
    const localScene = {
      ...createScene(),
      appState: { name: "Local edit" },
    };
    const locallyEdited = await PresentationStore.savePresentation(
      synced,
      created.document.id,
      localScene,
    );
    const remoteScene = {
      ...createScene(),
      appState: { name: "Remote edit" },
      elements: [],
    };

    const reconciled = await PresentationStore.reconcileRemote(
      locallyEdited,
      [
        {
          metadata: {
            id: created.document.id,
            title: "Remote edit",
            createdAt: 1,
            updatedAt: 2,
            lastOpenedAt: 2,
            remoteVersion: 2,
            remoteContentHash: "hash-2",
          },
          scene: remoteScene,
        },
      ],
      createScene(),
    );

    expect(reconciled?.index.presentations).toHaveLength(2);
    expect(
      reconciled?.index.presentations.some((presentation) =>
        presentation.title.includes("conflict"),
      ),
    ).toBe(true);
    const conflict = reconciled?.index.presentations.find(
      (presentation) => presentation.id !== created.document.id,
    );
    expect(conflict?.sync.remoteVersion).toBe(0);
    expect(
      conflict && (await PresentationStore.getDocument(conflict.id))?.scene,
    ).toMatchObject({ appState: { name: conflict?.title } });
  });

  it("recovers edited content under a new id after a remote deletion", async () => {
    const created = await PresentationStore.initialize(createScene());
    const synced = await PresentationStore.markSynced(
      created.index,
      created.document.id,
      1,
      "hash-1",
      created.document.version,
    );
    const localScene = {
      ...createScene(),
      appState: { name: "Edited offline" },
    };
    const locallyEdited = await PresentationStore.savePresentation(
      synced,
      created.document.id,
      localScene,
    );

    const reconciled = await PresentationStore.reconcileRemote(
      locallyEdited,
      [],
      createScene(),
    );

    expect(reconciled?.index.presentations).toHaveLength(1);
    expect(reconciled?.document.id).not.toBe(created.document.id);
    expect(reconciled?.document.title).toContain("recovered");
    expect(reconciled?.document.sync.remoteVersion).toBe(0);
    expect(reconciled?.document.scene.elements).toHaveLength(1);
  });
});
