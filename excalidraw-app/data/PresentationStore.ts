import { debounce, randomId } from "@excalidraw/common";
import { createStore, del, get, set } from "idb-keyval";

import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import { SAVE_TO_LOCAL_STORAGE_TIMEOUT, STORAGE_KEYS } from "../app_constants";
import {
  createPresentationAnimationMetadata,
  normalizePresentationAnimationMetadata,
  type PresentationAnimationMetadata,
} from "../presentation/animations";

import type { CanvasScene } from "./WorkspaceStore";

const presentationStore = createStore(
  "drawsy-presentation-db",
  "presentation-store",
);
const PRESENTATION_INDEX_KEY = "presentation-index";
const LEGACY_PRESENTATION_DOCUMENT_KEY = "presentation-document";
const PRESENTATION_INDEX_SCHEMA_VERSION = 1;
const PRESENTATION_DOCUMENT_SCHEMA_VERSION = 3;

export type PresentationScene = CanvasScene & {
  presentation: PresentationAnimationMetadata;
};

export type PresentationDocumentMetadata = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number;
};

export type PresentationIndex = {
  schemaVersion: typeof PRESENTATION_INDEX_SCHEMA_VERSION;
  activePresentationId: string;
  presentations: PresentationDocumentMetadata[];
};

export type PresentationDocument = PresentationDocumentMetadata & {
  scene: PresentationScene;
};

export type PresentationResult = {
  index: PresentationIndex;
  document: PresentationDocument;
};

type StoredPresentationDocument = PresentationDocumentMetadata & {
  schemaVersion: typeof PRESENTATION_DOCUMENT_SCHEMA_VERSION;
  scene: {
    elements: readonly ExcalidrawElement[];
    appState: Partial<AppState>;
    files: BinaryFiles;
  };
  presentation: PresentationAnimationMetadata;
};

type LegacyPresentationDocument = {
  schemaVersion: 1 | 2;
  title?: string;
  scene: {
    elements: readonly ExcalidrawElement[];
    appState: Partial<AppState>;
    files: BinaryFiles;
  };
  presentation?: PresentationAnimationMetadata;
  updatedAt?: number;
};

const presentationDocumentKey = (id: string) => `presentation-document:${id}`;

const getSceneTitle = (scene: CanvasScene) =>
  scene.appState?.name?.trim() || "Untitled presentation";

const normalizeScene = (
  scene: PresentationScene,
  title: string,
): StoredPresentationDocument["scene"] => ({
  elements: scene.elements || [],
  appState: {
    ...clearAppStateForLocalStorage(scene.appState || {}),
    name: title,
  },
  files: scene.files || {},
});

const createMetadata = (scene: CanvasScene): PresentationDocumentMetadata => {
  const now = Date.now();
  return {
    id: randomId(),
    title: getSceneTitle(scene),
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  };
};

const toDocument = (
  stored: StoredPresentationDocument,
): PresentationDocument => ({
  id: stored.id,
  title: stored.title,
  createdAt: stored.createdAt,
  updatedAt: stored.updatedAt,
  lastOpenedAt: stored.lastOpenedAt,
  scene: {
    elements: stored.scene.elements || [],
    appState: {
      ...stored.scene.appState,
      name: stored.title,
    },
    files: stored.scene.files || {},
    presentation: normalizePresentationAnimationMetadata(stored.presentation),
  },
});

const getIndex = () =>
  get<PresentationIndex>(PRESENTATION_INDEX_KEY, presentationStore);

const getDocument = async (id: string) => {
  const stored = await get<StoredPresentationDocument>(
    presentationDocumentKey(id),
    presentationStore,
  );
  return stored?.schemaVersion === PRESENTATION_DOCUMENT_SCHEMA_VERSION
    ? toDocument(stored)
    : null;
};

const persistIndex = (index: PresentationIndex) =>
  set(PRESENTATION_INDEX_KEY, index, presentationStore);

const persistDocument = async (
  metadata: PresentationDocumentMetadata,
  scene: PresentationScene,
) => {
  const document: StoredPresentationDocument = {
    ...metadata,
    schemaVersion: PRESENTATION_DOCUMENT_SCHEMA_VERSION,
    scene: normalizeScene(scene, metadata.title),
    presentation: normalizePresentationAnimationMetadata(scene.presentation),
  };
  await set(presentationDocumentKey(metadata.id), document, presentationStore);
};

const isPresentationIndex = (index: unknown): index is PresentationIndex =>
  !!index &&
  typeof index === "object" &&
  (index as PresentationIndex).schemaVersion ===
    PRESENTATION_INDEX_SCHEMA_VERSION &&
  Array.isArray((index as PresentationIndex).presentations) &&
  typeof (index as PresentationIndex).activePresentationId === "string";

const withPresentationLock = async <T>(
  operation: () => Promise<T>,
): Promise<T> => {
  const lockManager =
    typeof navigator === "undefined" ? undefined : navigator.locks;
  if (!lockManager) {
    return operation();
  }
  return lockManager.request("drawsy-presentations", operation);
};

const getLatestMutationIndex = async (requested: PresentationIndex) => {
  const latest = await getIndex();
  if (!isPresentationIndex(latest)) {
    return requested;
  }
  return {
    ...latest,
    activePresentationId: latest.presentations.some(
      (presentation) => presentation.id === requested.activePresentationId,
    )
      ? requested.activePresentationId
      : latest.activePresentationId,
  };
};

const createPresentationUnlocked = async (
  index: PresentationIndex,
  scene: PresentationScene,
): Promise<PresentationResult> => {
  const metadata = createMetadata(scene);
  const nextIndex: PresentationIndex = {
    ...index,
    activePresentationId: metadata.id,
    presentations: [...index.presentations, metadata],
  };
  await persistDocument(metadata, scene);
  await persistIndex(nextIndex);
  return {
    index: nextIndex,
    document: {
      ...metadata,
      scene: {
        ...scene,
        appState: { ...scene.appState, name: metadata.title },
      },
    },
  };
};

export class PresentationStore {
  private static pendingScenes = new Map<
    string,
    { revision: number; scene: PresentationScene }
  >();
  private static sceneRevisions = new Map<string, number>();

  private static persistPendingScene = async (
    presentationId: string,
    scene: PresentationScene,
    revision: number,
  ) =>
    withPresentationLock(async () => {
      if (this.sceneRevisions.get(presentationId) !== revision) {
        return;
      }
      const index = await getIndex();
      const metadata = index?.presentations.find(
        (presentation) => presentation.id === presentationId,
      );
      if (metadata) {
        await persistDocument(metadata, scene);
      }
    });

  private static saveScenesDebounced = debounce(async () => {
    const pendingScenes = [...this.pendingScenes.entries()];
    pendingScenes.forEach(([id, pending]) => {
      if (this.pendingScenes.get(id) === pending) {
        this.pendingScenes.delete(id);
      }
    });
    await Promise.all(
      pendingScenes.map(([id, pending]) =>
        this.persistPendingScene(id, pending.scene, pending.revision),
      ),
    );
  }, SAVE_TO_LOCAL_STORAGE_TIMEOUT);

  static loadActive() {
    try {
      return (
        localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_PRESENTATION_ACTIVE) ===
        "true"
      );
    } catch {
      return false;
    }
  }

  static saveActive(active: boolean) {
    try {
      localStorage.setItem(
        STORAGE_KEYS.LOCAL_STORAGE_PRESENTATION_ACTIVE,
        active ? "true" : "false",
      );
    } catch (error) {
      console.error(error);
    }
  }

  static async initialize(
    initialScene: PresentationScene,
  ): Promise<PresentationResult> {
    return withPresentationLock(async () => {
      const index = await getIndex();
      if (isPresentationIndex(index)) {
        const activeDocument = await getDocument(index.activePresentationId);
        if (activeDocument) {
          return { index, document: activeDocument };
        }

        return createPresentationUnlocked(index, initialScene);
      }

      const legacy = await get<LegacyPresentationDocument>(
        LEGACY_PRESENTATION_DOCUMENT_KEY,
        presentationStore,
      );
      if (
        legacy &&
        (legacy.schemaVersion === 1 || legacy.schemaVersion === 2) &&
        legacy.scene
      ) {
        const now = Date.now();
        const metadata: PresentationDocumentMetadata = {
          id: randomId(),
          title: legacy.title?.trim() || "Presentation",
          createdAt: legacy.updatedAt || now,
          updatedAt: legacy.updatedAt || now,
          lastOpenedAt: now,
        };
        const migratedScene: PresentationScene = {
          elements: legacy.scene.elements || [],
          appState: {
            ...legacy.scene.appState,
            name: metadata.title,
          },
          files: legacy.scene.files || {},
          presentation: normalizePresentationAnimationMetadata(
            legacy.presentation || createPresentationAnimationMetadata(),
          ),
        };
        const migratedIndex: PresentationIndex = {
          schemaVersion: PRESENTATION_INDEX_SCHEMA_VERSION,
          activePresentationId: metadata.id,
          presentations: [metadata],
        };
        await persistDocument(metadata, migratedScene);
        await persistIndex(migratedIndex);
        return {
          index: migratedIndex,
          document: { ...metadata, scene: migratedScene },
        };
      }

      return createPresentationUnlocked(
        {
          schemaVersion: PRESENTATION_INDEX_SCHEMA_VERSION,
          activePresentationId: "",
          presentations: [],
        },
        initialScene,
      );
    });
  }

  static async createPresentation(
    index: PresentationIndex,
    scene: PresentationScene,
  ) {
    return withPresentationLock(async () =>
      createPresentationUnlocked(await getLatestMutationIndex(index), scene),
    );
  }

  static async openPresentation(
    index: PresentationIndex,
    presentationId: string,
  ) {
    return withPresentationLock(async () => {
      const currentIndex = await getLatestMutationIndex(index);
      const document = await getDocument(presentationId);
      const currentMetadata = currentIndex.presentations.find(
        (presentation) => presentation.id === presentationId,
      );
      if (!document || !currentMetadata) {
        return null;
      }

      const now = Date.now();
      const openedMetadata: PresentationDocumentMetadata = {
        ...currentMetadata,
        updatedAt: now,
        lastOpenedAt: now,
      };
      const nextIndex: PresentationIndex = {
        ...currentIndex,
        activePresentationId: presentationId,
        presentations: currentIndex.presentations.map((presentation) =>
          presentation.id === presentationId ? openedMetadata : presentation,
        ),
      };
      await persistDocument(openedMetadata, document.scene);
      await persistIndex(nextIndex);
      return {
        index: nextIndex,
        document: { ...document, ...openedMetadata },
      };
    });
  }

  static async renamePresentation(
    index: PresentationIndex,
    presentationId: string,
    title: string,
  ) {
    return withPresentationLock(async () => {
      const currentIndex = await getLatestMutationIndex(index);
      const metadata = currentIndex.presentations.find(
        (presentation) => presentation.id === presentationId,
      );
      const document = await getDocument(presentationId);
      if (!metadata || !document) {
        return currentIndex;
      }
      const normalizedTitle = title.trim() || metadata.title;
      const nextMetadata: PresentationDocumentMetadata = {
        ...metadata,
        title: normalizedTitle,
        updatedAt: Date.now(),
      };
      const nextIndex: PresentationIndex = {
        ...currentIndex,
        presentations: currentIndex.presentations.map((presentation) =>
          presentation.id === presentationId ? nextMetadata : presentation,
        ),
      };
      await persistDocument(nextMetadata, {
        ...document.scene,
        appState: { ...document.scene.appState, name: normalizedTitle },
      });
      await persistIndex(nextIndex);
      return nextIndex;
    });
  }

  static async deletePresentation(
    index: PresentationIndex,
    presentationId: string,
    fallbackScene: PresentationScene,
  ): Promise<PresentationResult | null> {
    return withPresentationLock(async () => {
      const currentIndex = await getLatestMutationIndex(index);
      if (
        !currentIndex.presentations.some((item) => item.id === presentationId)
      ) {
        return null;
      }

      const remaining = currentIndex.presentations.filter(
        (item) => item.id !== presentationId,
      );
      await del(presentationDocumentKey(presentationId), presentationStore);

      if (!remaining.length) {
        return createPresentationUnlocked(
          {
            schemaVersion: PRESENTATION_INDEX_SCHEMA_VERSION,
            activePresentationId: "",
            presentations: [],
          },
          fallbackScene,
        );
      }

      const nextActivePresentationId = remaining.some(
        (item) => item.id === currentIndex.activePresentationId,
      )
        ? currentIndex.activePresentationId
        : [...remaining].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)[0].id;
      const nextIndex: PresentationIndex = {
        ...currentIndex,
        activePresentationId: nextActivePresentationId,
        presentations: remaining,
      };
      await persistIndex(nextIndex);
      const document = await getDocument(nextActivePresentationId);
      return document ? { index: nextIndex, document } : null;
    });
  }

  static saveScene(presentationId: string, scene: PresentationScene) {
    const revision = (this.sceneRevisions.get(presentationId) || 0) + 1;
    this.sceneRevisions.set(presentationId, revision);
    this.pendingScenes.set(presentationId, { revision, scene });
    this.saveScenesDebounced();
  }

  static async flushSave(
    presentationId?: string | null,
    scene?: PresentationScene | null,
  ) {
    if (presentationId && scene) {
      const revision = (this.sceneRevisions.get(presentationId) || 0) + 1;
      this.sceneRevisions.set(presentationId, revision);
      this.pendingScenes.delete(presentationId);
      await this.persistPendingScene(presentationId, scene, revision);
      return;
    }
    await this.saveScenesDebounced.flush();
  }
}
