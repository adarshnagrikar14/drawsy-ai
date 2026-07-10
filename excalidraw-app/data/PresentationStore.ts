import { randomId } from "@excalidraw/common";
import { createStore, del, get, set } from "idb-keyval";

import {
  clearAppStateForDatabase,
  clearAppStateForLocalStorage,
} from "@excalidraw/excalidraw/appState";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../app_constants";
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
const LEGACY_PRESENTATION_INDEX_KEY = "presentation-index";
const LEGACY_PRESENTATION_DOCUMENT_KEY = "presentation-document";
const PRESENTATION_INDEX_SCHEMA_VERSION = 2;
const PRESENTATION_DOCUMENT_SCHEMA_VERSION = 4;
const GUEST_SCOPE = "guest";

export const PRESENTATION_SYNC_CHANNEL = "drawsy-presentation-sync";
export const PRESENTATION_CLIENT_ID = randomId();

let activeScope = GUEST_SCOPE;
let presentationSyncChannel: BroadcastChannel | null = null;

export type PresentationScene = CanvasScene & {
  presentation: PresentationAnimationMetadata;
};

export type PresentationSyncState = {
  remoteVersion: number;
  remoteContentHash: string | null;
  dirty: boolean;
  contentDirty: boolean;
};

export type PresentationDocumentMetadata = {
  id: string;
  title: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number;
  sync: PresentationSyncState;
};

export type PresentationPendingDelete = {
  id: string;
  remoteVersion: number;
};

export type PresentationIndex = {
  schemaVersion: typeof PRESENTATION_INDEX_SCHEMA_VERSION;
  activePresentationId: string;
  presentations: PresentationDocumentMetadata[];
  pendingDeletes: PresentationPendingDelete[];
};

export type PresentationDocument = PresentationDocumentMetadata & {
  scene: PresentationScene;
};

export type PresentationResult = {
  index: PresentationIndex;
  document: PresentationDocument;
};

export type RemotePresentationMetadata = Omit<
  PresentationDocumentMetadata,
  "version" | "sync"
> & {
  remoteVersion: number;
  remoteContentHash: string | null;
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

type LegacyPresentationMetadata = Omit<
  PresentationDocumentMetadata,
  "version" | "sync"
>;

type LegacyPresentationIndex = {
  schemaVersion: 1;
  activePresentationId: string;
  presentations: LegacyPresentationMetadata[];
};

type LegacyIndexedPresentationDocument = LegacyPresentationMetadata & {
  schemaVersion: 3;
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

const scopeForUser = (userId: string | null) =>
  userId ? `user:${userId}` : GUEST_SCOPE;

const presentationIndexKey = (scope = activeScope) =>
  `presentation-index:${scope}`;

const presentationDocumentKey = (id: string, scope = activeScope) =>
  `presentation-document:${scope}:${id}`;

const legacyIndexedDocumentKey = (id: string) => `presentation-document:${id}`;

const createSyncState = (
  sync?: Partial<PresentationSyncState>,
): PresentationSyncState => ({
  remoteVersion: Number(sync?.remoteVersion || 0),
  remoteContentHash:
    typeof sync?.remoteContentHash === "string" ? sync.remoteContentHash : null,
  dirty: sync?.dirty ?? true,
  contentDirty: sync?.contentDirty ?? sync?.dirty ?? true,
});

const getSceneTitle = (scene: CanvasScene) =>
  scene.appState?.name?.trim() || "Untitled presentation";

const getUniqueTitle = (index: PresentationIndex, title: string) => {
  const existingTitles = new Set(
    index.presentations.map((presentation) =>
      presentation.title.trim().toLocaleLowerCase(),
    ),
  );
  if (!existingTitles.has(title.toLocaleLowerCase())) {
    return title;
  }
  let suffix = 2;
  while (existingTitles.has(`${title} (${suffix})`.toLocaleLowerCase())) {
    suffix += 1;
  }
  return `${title} (${suffix})`;
};

const normalizeLocalScene = (
  scene: PresentationScene,
  title: string,
): PresentationScene => ({
  elements: scene.elements || [],
  appState: {
    ...clearAppStateForLocalStorage(scene.appState || {}),
    name: title,
  },
  files: scene.files || {},
  presentation: normalizePresentationAnimationMetadata(scene.presentation),
});

export const normalizePresentationSceneForSync = (
  scene: PresentationScene,
): PresentationScene => ({
  elements: scene.elements || [],
  appState: clearAppStateForDatabase(scene.appState || {}),
  files: scene.files || {},
  presentation: normalizePresentationAnimationMetadata(scene.presentation),
});

const getLocalOnlyAppState = (scene?: PresentationScene | null) => {
  const localState = clearAppStateForLocalStorage(scene?.appState || {});
  const synchronizedState = clearAppStateForDatabase(scene?.appState || {});
  for (const key of Object.keys(synchronizedState) as Array<
    keyof typeof localState
  >) {
    delete localState[key];
  }
  return localState;
};

export const mergeRemotePresentationScene = (
  remote: PresentationScene,
  title: string,
  local?: PresentationScene | null,
): PresentationScene => ({
  elements: remote.elements || [],
  appState: {
    ...getLocalOnlyAppState(local),
    ...clearAppStateForDatabase(remote.appState || {}),
    name: title,
  },
  files: remote.files || {},
  presentation: normalizePresentationAnimationMetadata(remote.presentation),
});

const sortObjectKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortObjectKeys((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
};

const scenesMatch = (first: PresentationScene, second: PresentationScene) =>
  JSON.stringify(sortObjectKeys(normalizePresentationSceneForSync(first))) ===
  JSON.stringify(sortObjectKeys(normalizePresentationSceneForSync(second)));

const createMetadata = (
  scene: PresentationScene,
): PresentationDocumentMetadata => {
  const now = Date.now();
  return {
    id: randomId(),
    title: getSceneTitle(scene),
    version: 1,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    sync: createSyncState(),
  };
};

const toDocument = (
  stored: StoredPresentationDocument,
): PresentationDocument => ({
  id: stored.id,
  title: stored.title,
  version: stored.version,
  createdAt: stored.createdAt,
  updatedAt: stored.updatedAt,
  lastOpenedAt: stored.lastOpenedAt,
  sync: createSyncState(stored.sync),
  scene: {
    elements: stored.scene.elements || [],
    appState: { ...stored.scene.appState, name: stored.title },
    files: stored.scene.files || {},
    presentation: normalizePresentationAnimationMetadata(stored.presentation),
  },
});

const persistDocument = async (
  metadata: PresentationDocumentMetadata,
  scene: PresentationScene,
  scope = activeScope,
) => {
  const normalized = normalizeLocalScene(scene, metadata.title);
  const document: StoredPresentationDocument = {
    ...metadata,
    sync: createSyncState(metadata.sync),
    schemaVersion: PRESENTATION_DOCUMENT_SCHEMA_VERSION,
    scene: {
      elements: normalized.elements || [],
      appState: normalized.appState || {},
      files: normalized.files || {},
    },
    presentation: normalized.presentation,
  };
  await set(
    presentationDocumentKey(metadata.id, scope),
    document,
    presentationStore,
  );
};

const getDocument = async (id: string, scope = activeScope) => {
  const stored = await get<StoredPresentationDocument>(
    presentationDocumentKey(id, scope),
    presentationStore,
  );
  return stored?.schemaVersion === PRESENTATION_DOCUMENT_SCHEMA_VERSION
    ? toDocument(stored)
    : null;
};

const getScopedIndex = (scope = activeScope) =>
  get<PresentationIndex>(presentationIndexKey(scope), presentationStore);

const persistIndex = async (index: PresentationIndex, scope = activeScope) => {
  await set(presentationIndexKey(scope), index, presentationStore);
  const hasPendingWork =
    index.pendingDeletes.length > 0 ||
    index.presentations.some((presentation) => presentation.sync.dirty);
  if (
    hasPendingWork &&
    typeof window !== "undefined" &&
    typeof window.BroadcastChannel !== "undefined"
  ) {
    presentationSyncChannel ||= new window.BroadcastChannel(
      PRESENTATION_SYNC_CHANNEL,
    );
    presentationSyncChannel.postMessage({
      source: PRESENTATION_CLIENT_ID,
      scope,
    });
  }
};

const isPresentationIndex = (index: unknown): index is PresentationIndex =>
  !!index &&
  typeof index === "object" &&
  (index as PresentationIndex).schemaVersion ===
    PRESENTATION_INDEX_SCHEMA_VERSION &&
  Array.isArray((index as PresentationIndex).presentations) &&
  Array.isArray((index as PresentationIndex).pendingDeletes) &&
  typeof (index as PresentationIndex).activePresentationId === "string";

const withPresentationLock = async <T>(
  operation: () => Promise<T>,
  scope = activeScope,
): Promise<T> => {
  const lockManager =
    typeof navigator === "undefined" ? undefined : navigator.locks;
  if (!lockManager) {
    return operation();
  }
  return lockManager.request(`drawsy-presentations:${scope}`, async () => {
    if (activeScope !== scope) {
      throw new Error("Presentation scope changed while waiting for storage");
    }
    return operation();
  });
};

const getLatestMutationIndex = async (requested: PresentationIndex) => {
  const latest = await getScopedIndex();
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
      scene: normalizeLocalScene(scene, metadata.title),
    },
  };
};

const migrateLegacyIndex = async (
  legacy: LegacyPresentationIndex,
  targetScope = activeScope,
) => {
  const presentations: PresentationDocumentMetadata[] = [];
  for (const metadata of legacy.presentations) {
    const stored = await get<LegacyIndexedPresentationDocument>(
      legacyIndexedDocumentKey(metadata.id),
      presentationStore,
    );
    if (!stored || stored.schemaVersion !== 3) {
      continue;
    }
    const migratedMetadata: PresentationDocumentMetadata = {
      ...metadata,
      version: 1,
      sync: createSyncState(),
    };
    presentations.push(migratedMetadata);
    await persistDocument(
      migratedMetadata,
      {
        elements: stored.scene.elements || [],
        appState: { ...stored.scene.appState, name: metadata.title },
        files: stored.scene.files || {},
        presentation: normalizePresentationAnimationMetadata(
          stored.presentation,
        ),
      },
      targetScope,
    );
  }
  if (!presentations.length) {
    return null;
  }
  const index: PresentationIndex = {
    schemaVersion: PRESENTATION_INDEX_SCHEMA_VERSION,
    activePresentationId: presentations.some(
      (presentation) => presentation.id === legacy.activePresentationId,
    )
      ? legacy.activePresentationId
      : presentations[0].id,
    presentations,
    pendingDeletes: [],
  };
  await persistIndex(index, targetScope);
  return index;
};

const migrateLegacyDocument = async (
  legacy: LegacyPresentationDocument,
  targetScope = activeScope,
): Promise<PresentationResult> => {
  const now = Date.now();
  const metadata: PresentationDocumentMetadata = {
    id: randomId(),
    title: legacy.title?.trim() || "Presentation",
    version: 1,
    createdAt: legacy.updatedAt || now,
    updatedAt: legacy.updatedAt || now,
    lastOpenedAt: now,
    sync: createSyncState(),
  };
  const scene: PresentationScene = {
    elements: legacy.scene.elements || [],
    appState: { ...legacy.scene.appState, name: metadata.title },
    files: legacy.scene.files || {},
    presentation: normalizePresentationAnimationMetadata(
      legacy.presentation || createPresentationAnimationMetadata(),
    ),
  };
  const index: PresentationIndex = {
    schemaVersion: PRESENTATION_INDEX_SCHEMA_VERSION,
    activePresentationId: metadata.id,
    presentations: [metadata],
    pendingDeletes: [],
  };
  await persistDocument(metadata, scene, targetScope);
  await persistIndex(index, targetScope);
  return { index, document: { ...metadata, scene } };
};

const openPresentationUnlocked = async (
  currentIndex: PresentationIndex,
  presentationId: string,
  document: PresentationDocument,
) => {
  const metadata = currentIndex.presentations.find(
    (presentation) => presentation.id === presentationId,
  );
  if (!metadata) {
    return null;
  }
  const openedMetadata: PresentationDocumentMetadata = {
    ...metadata,
    version: metadata.version + 1,
    updatedAt: Date.now(),
    lastOpenedAt: Date.now(),
    sync: { ...metadata.sync, dirty: true },
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
};

export class PresentationStore {
  static setScope(userId: string | null) {
    activeScope = scopeForUser(userId);
  }

  static getScope() {
    return activeScope;
  }

  static getIndex() {
    return getScopedIndex();
  }

  static getDocument(presentationId: string) {
    return getDocument(presentationId);
  }

  static async hasPresentations() {
    return !!(await getScopedIndex());
  }

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
      let index = await getScopedIndex();

      if (!index && activeScope === GUEST_SCOPE) {
        const legacyIndex = await get<LegacyPresentationIndex>(
          LEGACY_PRESENTATION_INDEX_KEY,
          presentationStore,
        );
        if (legacyIndex?.schemaVersion === 1) {
          index = (await migrateLegacyIndex(legacyIndex)) || undefined;
        }
      }

      if (isPresentationIndex(index)) {
        const activeDocument = await getDocument(index.activePresentationId);
        if (activeDocument) {
          return { index, document: activeDocument };
        }

        const available = (
          await Promise.all(
            index.presentations.map(async (metadata) => ({
              metadata,
              document: await getDocument(metadata.id),
            })),
          )
        ).filter(
          (
            candidate,
          ): candidate is {
            metadata: PresentationDocumentMetadata;
            document: PresentationDocument;
          } => !!candidate.document,
        );
        if (available.length) {
          const recovered = [...available].sort(
            (first, second) =>
              second.metadata.lastOpenedAt - first.metadata.lastOpenedAt,
          )[0];
          const repairedIndex: PresentationIndex = {
            ...index,
            activePresentationId: recovered.metadata.id,
          };
          await persistIndex(repairedIndex);
          return { index: repairedIndex, document: recovered.document };
        }
      }

      if (activeScope === GUEST_SCOPE) {
        const legacy = await get<LegacyPresentationDocument>(
          LEGACY_PRESENTATION_DOCUMENT_KEY,
          presentationStore,
        );
        if (
          legacy &&
          (legacy.schemaVersion === 1 || legacy.schemaVersion === 2) &&
          legacy.scene
        ) {
          return migrateLegacyDocument(legacy);
        }
      }

      return createPresentationUnlocked(
        {
          schemaVersion: PRESENTATION_INDEX_SCHEMA_VERSION,
          activePresentationId: "",
          presentations: [],
          pendingDeletes: [],
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
      const metadata = currentIndex.presentations.find(
        (presentation) => presentation.id === presentationId,
      );
      if (!document || !metadata) {
        return null;
      }
      return openPresentationUnlocked(currentIndex, presentationId, document);
    });
  }

  static async openCachedPresentation(
    index: PresentationIndex,
    presentationId: string,
  ) {
    return withPresentationLock(async () => {
      const currentIndex = await getLatestMutationIndex(index);
      const document = await getDocument(presentationId);
      if (!document) {
        return null;
      }
      const cachedIndex: PresentationIndex = {
        ...currentIndex,
        presentations: currentIndex.presentations.map((presentation) =>
          presentation.id === presentationId
            ? {
                ...presentation,
                title: document.title,
                sync: {
                  ...document.sync,
                  dirty: false,
                  contentDirty: false,
                },
              }
            : presentation,
        ),
      };
      const opened = await openPresentationUnlocked(
        cachedIndex,
        presentationId,
        document,
      );
      return opened ? { ...opened, usedCachedScene: true } : null;
    });
  }

  static async savePresentation(
    index: PresentationIndex,
    presentationId: string,
    scene: PresentationScene,
  ) {
    return withPresentationLock(async () => {
      const expected = index.presentations.find(
        (presentation) => presentation.id === presentationId,
      );
      const currentIndex = await getLatestMutationIndex(index);
      const metadata = currentIndex.presentations.find(
        (presentation) => presentation.id === presentationId,
      );
      if (!metadata) {
        return currentIndex;
      }
      const currentDocument = await getDocument(presentationId);

      if (
        expected &&
        metadata.version > expected.version &&
        currentDocument &&
        !scenesMatch(currentDocument.scene, scene)
      ) {
        const conflictTitle = getUniqueTitle(
          currentIndex,
          `${getSceneTitle(scene)} (conflict)`,
        );
        const conflictMetadata: PresentationDocumentMetadata = {
          ...metadata,
          id: randomId(),
          title: conflictTitle,
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastOpenedAt: Date.now(),
          sync: createSyncState(),
        };
        const conflictIndex: PresentationIndex = {
          ...currentIndex,
          activePresentationId:
            index.activePresentationId === presentationId
              ? conflictMetadata.id
              : currentIndex.activePresentationId,
          presentations: [...currentIndex.presentations, conflictMetadata],
        };
        await persistDocument(conflictMetadata, {
          ...scene,
          appState: { ...scene.appState, name: conflictTitle },
        });
        await persistIndex(conflictIndex);
        return conflictIndex;
      }

      const title = getSceneTitle(scene);
      const contentChanged =
        !currentDocument || !scenesMatch(currentDocument.scene, scene);
      const titleChanged = metadata.title !== title;
      if (!contentChanged && !titleChanged) {
        await persistDocument(metadata, scene);
        return currentIndex;
      }

      const nextMetadata: PresentationDocumentMetadata = {
        ...metadata,
        title,
        version: metadata.version + 1,
        updatedAt: Date.now(),
        sync: {
          ...metadata.sync,
          dirty: true,
          contentDirty: metadata.sync.contentDirty || contentChanged,
        },
      };
      const nextIndex: PresentationIndex = {
        ...currentIndex,
        presentations: currentIndex.presentations.map((presentation) =>
          presentation.id === presentationId ? nextMetadata : presentation,
        ),
      };
      await persistDocument(nextMetadata, scene);
      await persistIndex(nextIndex);
      return nextIndex;
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
      if (normalizedTitle === metadata.title) {
        return currentIndex;
      }
      const nextMetadata: PresentationDocumentMetadata = {
        ...metadata,
        title: normalizedTitle,
        version: metadata.version + 1,
        updatedAt: Date.now(),
        sync: { ...metadata.sync, dirty: true },
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
      const deleted = currentIndex.presentations.find(
        (presentation) => presentation.id === presentationId,
      );
      if (!deleted) {
        return null;
      }
      const remaining = currentIndex.presentations.filter(
        (presentation) => presentation.id !== presentationId,
      );
      const pendingDeletes = [...currentIndex.pendingDeletes];
      if (deleted.sync.remoteVersion) {
        pendingDeletes.push({
          id: presentationId,
          remoteVersion: deleted.sync.remoteVersion,
        });
      }
      await del(presentationDocumentKey(presentationId), presentationStore);

      if (!remaining.length) {
        return createPresentationUnlocked(
          {
            ...currentIndex,
            activePresentationId: "",
            presentations: [],
            pendingDeletes,
          },
          fallbackScene,
        );
      }

      const activePresentationId = remaining.some(
        (presentation) => presentation.id === currentIndex.activePresentationId,
      )
        ? currentIndex.activePresentationId
        : [...remaining].sort(
            (first, second) => second.lastOpenedAt - first.lastOpenedAt,
          )[0].id;
      const nextIndex: PresentationIndex = {
        ...currentIndex,
        activePresentationId,
        presentations: remaining,
        pendingDeletes,
      };
      await persistIndex(nextIndex);
      const document = await getDocument(activePresentationId);
      return document ? { index: nextIndex, document } : null;
    });
  }

  static async getDocuments(index: PresentationIndex) {
    const documents = await Promise.all(
      index.presentations.map((presentation) => getDocument(presentation.id)),
    );
    return documents.filter(
      (document): document is PresentationDocument => !!document,
    );
  }

  static async seedFromGuest() {
    if (activeScope === GUEST_SCOPE || (await getScopedIndex())) {
      return null;
    }
    let guestIndex = await getScopedIndex(GUEST_SCOPE);
    if (!guestIndex) {
      const legacyIndex = await get<LegacyPresentationIndex>(
        LEGACY_PRESENTATION_INDEX_KEY,
        presentationStore,
      );
      if (legacyIndex?.schemaVersion === 1) {
        guestIndex =
          (await migrateLegacyIndex(legacyIndex, GUEST_SCOPE)) || undefined;
      }
    }
    if (!guestIndex) {
      const legacy = await get<LegacyPresentationDocument>(
        LEGACY_PRESENTATION_DOCUMENT_KEY,
        presentationStore,
      );
      if (
        legacy &&
        (legacy.schemaVersion === 1 || legacy.schemaVersion === 2) &&
        legacy.scene
      ) {
        guestIndex = (await migrateLegacyDocument(legacy, GUEST_SCOPE)).index;
      }
    }
    if (!guestIndex || !isPresentationIndex(guestIndex)) {
      return null;
    }
    const guestDocuments = (
      await Promise.all(
        guestIndex.presentations.map((presentation) =>
          getDocument(presentation.id, GUEST_SCOPE),
        ),
      )
    ).filter((document): document is PresentationDocument => !!document);
    if (!guestDocuments.length) {
      return null;
    }
    const presentations = guestDocuments.map(
      ({ scene: _scene, ...metadata }): PresentationDocumentMetadata => ({
        ...metadata,
        version: 1,
        sync: createSyncState(),
      }),
    );
    const activePresentationId = presentations.some(
      (presentation) => presentation.id === guestIndex.activePresentationId,
    )
      ? guestIndex.activePresentationId
      : presentations[0].id;
    const index: PresentationIndex = {
      schemaVersion: PRESENTATION_INDEX_SCHEMA_VERSION,
      activePresentationId,
      presentations,
      pendingDeletes: [],
    };
    await Promise.all(
      guestDocuments.map((document) => {
        const metadata = presentations.find(
          (presentation) => presentation.id === document.id,
        );
        return metadata
          ? persistDocument(metadata, document.scene)
          : Promise.resolve();
      }),
    );
    await persistIndex(index);
    const document = await getDocument(activePresentationId);
    return document ? { index, document } : null;
  }

  static async replaceWithRemote(
    documents: Array<{
      metadata: RemotePresentationMetadata;
      scene: PresentationScene | null;
    }>,
  ) {
    const previous = await getScopedIndex();
    if (previous) {
      await Promise.all(
        previous.presentations.map((presentation) =>
          del(presentationDocumentKey(presentation.id), presentationStore),
        ),
      );
    }
    const presentations: PresentationDocumentMetadata[] = documents.map(
      ({ metadata: { remoteVersion, remoteContentHash, ...metadata } }) => ({
        ...metadata,
        version: 1,
        sync: {
          remoteVersion,
          remoteContentHash,
          dirty: false,
          contentDirty: false,
        },
      }),
    );
    const active = [...presentations].sort(
      (first, second) => second.lastOpenedAt - first.lastOpenedAt,
    )[0];
    if (!active) {
      return null;
    }
    const index: PresentationIndex = {
      schemaVersion: PRESENTATION_INDEX_SCHEMA_VERSION,
      activePresentationId: active.id,
      presentations,
      pendingDeletes: [],
    };
    await Promise.all(
      documents.map(({ metadata, scene }) => {
        const local = presentations.find(
          (presentation) => presentation.id === metadata.id,
        );
        return local && scene
          ? persistDocument(local, scene)
          : Promise.resolve();
      }),
    );
    await persistIndex(index);
    const document = await getDocument(active.id);
    return document ? { index, document } : null;
  }

  static async cacheRemotePresentation(
    index: PresentationIndex,
    presentationId: string,
    scene: PresentationScene,
  ) {
    return withPresentationLock(async () => {
      const currentIndex = await getLatestMutationIndex(index);
      const metadata = currentIndex.presentations.find(
        (presentation) => presentation.id === presentationId,
      );
      if (metadata) {
        await persistDocument(metadata, scene);
      }
      return currentIndex;
    });
  }

  static async markSynced(
    index: PresentationIndex,
    presentationId: string,
    remoteVersion: number,
    remoteContentHash: string | null,
    expectedLocalVersion: number,
  ) {
    return withPresentationLock(async () => {
      const currentIndex = (await getScopedIndex()) || index;
      const metadata = currentIndex.presentations.find(
        (presentation) => presentation.id === presentationId,
      );
      const document = await getDocument(presentationId);
      if (!metadata) {
        const existingDelete = currentIndex.pendingDeletes.some(
          (pending) => pending.id === presentationId,
        );
        const nextIndex: PresentationIndex = {
          ...currentIndex,
          pendingDeletes: existingDelete
            ? currentIndex.pendingDeletes.map((pending) =>
                pending.id === presentationId
                  ? { ...pending, remoteVersion }
                  : pending,
              )
            : [
                ...currentIndex.pendingDeletes,
                { id: presentationId, remoteVersion },
              ],
        };
        await persistIndex(nextIndex);
        return nextIndex;
      }
      if (!document) {
        const changedWhileSyncing = metadata.version !== expectedLocalVersion;
        const nextIndex: PresentationIndex = {
          ...currentIndex,
          presentations: currentIndex.presentations.map((presentation) =>
            presentation.id === presentationId
              ? {
                  ...presentation,
                  sync: {
                    remoteVersion,
                    remoteContentHash,
                    dirty: changedWhileSyncing,
                    contentDirty: changedWhileSyncing
                      ? presentation.sync.contentDirty
                      : false,
                  },
                }
              : presentation,
          ),
        };
        await persistIndex(nextIndex);
        return nextIndex;
      }
      const changedWhileSyncing = metadata.version !== expectedLocalVersion;
      const syncedMetadata: PresentationDocumentMetadata = {
        ...metadata,
        sync: {
          remoteVersion,
          remoteContentHash,
          dirty: changedWhileSyncing,
          contentDirty: changedWhileSyncing
            ? metadata.sync.contentDirty
            : false,
        },
      };
      const nextIndex: PresentationIndex = {
        ...currentIndex,
        presentations: currentIndex.presentations.map((presentation) =>
          presentation.id === presentationId ? syncedMetadata : presentation,
        ),
      };
      await persistDocument(syncedMetadata, document.scene);
      await persistIndex(nextIndex);
      return nextIndex;
    });
  }

  static async acknowledgeDelete(
    index: PresentationIndex,
    presentationId: string,
  ) {
    return withPresentationLock(async () => {
      const currentIndex = (await getScopedIndex()) || index;
      const nextIndex: PresentationIndex = {
        ...currentIndex,
        pendingDeletes: currentIndex.pendingDeletes.filter(
          (pending) => pending.id !== presentationId,
        ),
      };
      await persistIndex(nextIndex);
      return nextIndex;
    });
  }

  static async reconcileRemote(
    index: PresentationIndex,
    documents: Array<{
      metadata: RemotePresentationMetadata;
      scene: PresentationScene | null;
    }>,
    replacementScene: PresentationScene,
  ) {
    return withPresentationLock(async () => {
      const currentIndex = await getLatestMutationIndex(index);
      const pendingDeleteIds = new Set(
        currentIndex.pendingDeletes.map((pending) => pending.id),
      );
      const remoteIds = new Set(documents.map(({ metadata }) => metadata.id));
      const nextPresentations: PresentationDocumentMetadata[] = [];
      let activeConflictId: string | null = null;

      for (const { metadata: remote, scene } of documents) {
        if (pendingDeleteIds.has(remote.id)) {
          continue;
        }
        const local = currentIndex.presentations.find(
          (presentation) => presentation.id === remote.id,
        );
        if (
          local?.sync.dirty &&
          (local.sync.remoteVersion === remote.remoteVersion ||
            (remote.remoteContentHash !== null &&
              local.sync.remoteContentHash === remote.remoteContentHash))
        ) {
          nextPresentations.push({
            ...local,
            sync: {
              ...local.sync,
              remoteVersion: remote.remoteVersion,
              remoteContentHash: remote.remoteContentHash,
            },
          });
          continue;
        }

        if (
          local?.sync.contentDirty &&
          local.sync.remoteVersion !== remote.remoteVersion
        ) {
          const localDocument = await getDocument(local.id);
          if (
            localDocument &&
            scene &&
            !scenesMatch(localDocument.scene, scene)
          ) {
            const conflictTitle = getUniqueTitle(
              {
                ...currentIndex,
                presentations: [
                  ...currentIndex.presentations,
                  ...nextPresentations,
                ],
              },
              `${local.title} (conflict)`,
            );
            const conflictMetadata: PresentationDocumentMetadata = {
              ...local,
              id: randomId(),
              title: conflictTitle,
              version: 1,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              sync: createSyncState(),
            };
            nextPresentations.push(conflictMetadata);
            await persistDocument(conflictMetadata, {
              ...localDocument.scene,
              appState: {
                ...localDocument.scene.appState,
                name: conflictTitle,
              },
            });
            if (local.id === currentIndex.activePresentationId) {
              activeConflictId = conflictMetadata.id;
            }
          }
        }

        const { remoteVersion, remoteContentHash, ...metadata } = remote;
        const preserveLocalMetadata =
          !!local?.sync.dirty && !local.sync.contentDirty;
        const localMetadata: PresentationDocumentMetadata = {
          ...metadata,
          title: preserveLocalMetadata ? local.title : metadata.title,
          lastOpenedAt: preserveLocalMetadata
            ? Math.max(local.lastOpenedAt, metadata.lastOpenedAt)
            : metadata.lastOpenedAt,
          version: local?.version || 1,
          sync: {
            remoteVersion,
            remoteContentHash,
            dirty: preserveLocalMetadata,
            contentDirty: false,
          },
        };
        nextPresentations.push(localMetadata);
        if (scene) {
          await persistDocument(localMetadata, {
            ...scene,
            appState: { ...scene.appState, name: localMetadata.title },
          });
        }
      }

      for (const local of currentIndex.presentations) {
        if (remoteIds.has(local.id) || pendingDeleteIds.has(local.id)) {
          continue;
        }
        if (local.sync.remoteVersion === 0) {
          nextPresentations.push(local);
          continue;
        }
        if (local.sync.contentDirty) {
          const document = await getDocument(local.id);
          if (document) {
            const conflictTitle = getUniqueTitle(
              {
                ...currentIndex,
                presentations: [
                  ...currentIndex.presentations,
                  ...nextPresentations,
                ],
              },
              `${local.title} (recovered)`,
            );
            const recovered: PresentationDocumentMetadata = {
              ...local,
              id: randomId(),
              title: conflictTitle,
              version: 1,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              sync: createSyncState(),
            };
            nextPresentations.push(recovered);
            await persistDocument(recovered, {
              ...document.scene,
              appState: { ...document.scene.appState, name: conflictTitle },
            });
            if (local.id === currentIndex.activePresentationId) {
              activeConflictId = recovered.id;
            }
          }
        }
      }

      if (!nextPresentations.length) {
        const replacement = createMetadata(replacementScene);
        nextPresentations.push(replacement);
        await persistDocument(replacement, replacementScene);
      }

      await Promise.all(
        currentIndex.presentations
          .filter(
            (presentation) =>
              !nextPresentations.some(
                (candidate) => candidate.id === presentation.id,
              ),
          )
          .map((presentation) =>
            del(presentationDocumentKey(presentation.id), presentationStore),
          ),
      );

      const activePresentationId =
        activeConflictId ||
        (nextPresentations.some(
          (presentation) =>
            presentation.id === currentIndex.activePresentationId,
        )
          ? currentIndex.activePresentationId
          : [...nextPresentations].sort(
              (first, second) => second.lastOpenedAt - first.lastOpenedAt,
            )[0].id);
      const nextIndex: PresentationIndex = {
        ...currentIndex,
        activePresentationId,
        presentations: nextPresentations,
      };
      await persistIndex(nextIndex);
      const document = await getDocument(activePresentationId);
      return document ? { index: nextIndex, document } : null;
    });
  }
}
