import {
  mergeRemotePresentationScene,
  normalizePresentationSceneForSync,
  PresentationStore,
  type PresentationIndex,
  type PresentationScene,
  type RemotePresentationMetadata,
} from "./PresentationStore";
import { PresentationApiError } from "./PresentationApi";

import type { PresentationApi } from "./PresentationApi";

type PresentationSyncApi = Pick<
  PresentationApi,
  | "getPresentations"
  | "getPresentationScene"
  | "putPresentation"
  | "patchPresentation"
  | "deletePresentation"
>;

export class PresentationSync {
  private userId: string | null = null;
  private replacementScene: PresentationScene;

  constructor(
    private readonly api: PresentationSyncApi,
    initialScene: PresentationScene,
  ) {
    this.replacementScene = initialScene;
  }

  async initialize(userId: string, initialScene: PresentationScene) {
    this.userId = userId;
    this.replacementScene = initialScene;
    PresentationStore.setScope(userId);
    const remote = await this.api.getPresentations();
    const hasLocalPresentations = await PresentationStore.hasPresentations();

    if (!hasLocalPresentations && remote.presentations.length > 0) {
      const remoteDocuments = await this.loadRemoteDocuments(remote);
      const replaced = await PresentationStore.replaceWithRemote(
        remoteDocuments,
      );
      if (replaced?.document) {
        return replaced;
      }
    }

    if (!hasLocalPresentations && remote.presentations.length === 0) {
      await PresentationStore.seedFromGuest();
    }

    let presentations = await PresentationStore.initialize(initialScene);
    const remoteDocuments = await this.loadRemoteDocuments(
      remote,
      presentations.index,
    );
    const reconciled = await PresentationStore.reconcileRemote(
      presentations.index,
      remoteDocuments,
      this.replacementScene,
    );
    if (reconciled?.document) {
      presentations = reconciled;
    }
    return presentations;
  }

  async push(
    startingIndex: PresentationIndex,
    allowConflictRetry = true,
  ): Promise<PresentationIndex> {
    const run = async () => {
      const persisted = await PresentationStore.getIndex();
      return this.pushUnlocked(persisted || startingIndex, allowConflictRetry);
    };
    const lockManager =
      typeof navigator === "undefined" ? undefined : navigator.locks;
    return lockManager && this.userId
      ? lockManager.request(
          `drawsy-cloud-presentation-sync:${this.userId}`,
          run,
        )
      : run();
  }

  async synchronize(startingIndex: PresentationIndex) {
    const reconciled = await this.reconcile(startingIndex);
    const index = await this.push(reconciled);
    return {
      index,
      document: await PresentationStore.getDocument(index.activePresentationId),
    };
  }

  async openPresentation(index: PresentationIndex, presentationId: string) {
    const metadata = index.presentations.find(
      (presentation) => presentation.id === presentationId,
    );
    if (!metadata) {
      return null;
    }
    const cached = await PresentationStore.getDocument(presentationId);
    if (
      !cached ||
      cached.sync.remoteContentHash !== metadata.sync.remoteContentHash
    ) {
      try {
        const scene = mergeRemotePresentationScene(
          await this.api.getPresentationScene(presentationId),
          metadata.title,
          cached?.scene,
        );
        index = await PresentationStore.cacheRemotePresentation(
          index,
          presentationId,
          scene,
        );
      } catch (error) {
        if (error instanceof PresentationApiError && error.status === 404) {
          const reconciled = await this.reconcile(index);
          const document = await PresentationStore.getDocument(
            reconciled.activePresentationId,
          );
          return document ? { index: reconciled, document } : null;
        }
        const canUseCachedScene =
          cached &&
          (!(error instanceof PresentationApiError) ||
            error.status === 408 ||
            error.status === 429 ||
            error.status >= 500);
        if (canUseCachedScene) {
          return PresentationStore.openCachedPresentation(
            index,
            presentationId,
          );
        }
        throw error;
      }
    }
    return PresentationStore.openPresentation(index, presentationId);
  }

  private async pushUnlocked(
    startingIndex: PresentationIndex,
    allowConflictRetry: boolean,
  ): Promise<PresentationIndex> {
    let index = startingIndex;

    for (const pending of [...index.pendingDeletes]) {
      try {
        await this.api.deletePresentation(pending.id, pending.remoteVersion);
      } catch (error) {
        if (!(error instanceof PresentationApiError)) {
          throw error;
        }
        if (error.status === 409) {
          const remote = await this.api.getPresentations();
          const current = remote.presentations.find(
            (presentation) => presentation.id === pending.id,
          );
          if (current) {
            await this.api.deletePresentation(pending.id, current.version);
          }
        } else if (error.status !== 404) {
          throw error;
        }
      }
      index = await PresentationStore.acknowledgeDelete(index, pending.id);
    }

    try {
      for (const metadata of index.presentations.filter(
        (presentation) => presentation.sync.dirty,
      )) {
        const document = await PresentationStore.getDocument(metadata.id);
        if (!document) {
          continue;
        }
        const remote = metadata.sync.contentDirty
          ? await this.api.putPresentation({
              ...document,
              scene: normalizePresentationSceneForSync(document.scene),
            })
          : await this.api.patchPresentation(document);
        index = await PresentationStore.markSynced(
          index,
          metadata.id,
          remote.version,
          remote.contentHash,
          metadata.version,
        );
      }
    } catch (error) {
      if (
        allowConflictRetry &&
        error instanceof PresentationApiError &&
        error.status === 409
      ) {
        const reconciled = await this.reconcile(index);
        return this.pushUnlocked(reconciled, false);
      }
      throw error;
    }
    return index;
  }

  private async reconcile(index: PresentationIndex) {
    const remote = await this.api.getPresentations();
    const documents = await this.loadRemoteDocuments(remote, index);
    const reconciled = await PresentationStore.reconcileRemote(
      index,
      documents,
      this.replacementScene,
    );
    return reconciled?.index || index;
  }

  private async loadRemoteDocuments(
    remote: Awaited<ReturnType<PresentationApi["getPresentations"]>>,
    localIndex?: PresentationIndex,
  ) {
    const activePresentationId = remote.presentations.some(
      (presentation) => presentation.id === localIndex?.activePresentationId,
    )
      ? localIndex?.activePresentationId
      : [...remote.presentations].sort(
          (first, second) => second.lastOpenedAt - first.lastOpenedAt,
        )[0]?.id;
    return Promise.all(
      remote.presentations.map(
        async ({ version, contentHash, ...presentation }) => {
          const local = localIndex?.presentations.find(
            (candidate) => candidate.id === presentation.id,
          );
          const localDocument = local
            ? await PresentationStore.getDocument(local.id)
            : null;
          const contentMatches =
            local?.sync.remoteVersion === version ||
            (contentHash !== null &&
              local?.sync.remoteContentHash === contentHash);
          const scene =
            localDocument && contentMatches
              ? {
                  ...localDocument.scene,
                  appState: {
                    ...localDocument.scene.appState,
                    name: presentation.title,
                  },
                }
              : presentation.id === activePresentationId || local?.sync.dirty
              ? mergeRemotePresentationScene(
                  await this.api.getPresentationScene(presentation.id),
                  presentation.title,
                  localDocument?.scene,
                )
              : null;
          const metadata: RemotePresentationMetadata = {
            ...presentation,
            remoteVersion: version,
            remoteContentHash: contentHash,
          };
          return { metadata, scene };
        },
      ),
    );
  }
}
