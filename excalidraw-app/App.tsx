import {
  DefaultSidebar,
  Excalidraw,
  TTDDialogTrigger,
  CaptureUpdateAction,
  reconcileElements,
  ExcalidrawAPIProvider,
  useExcalidrawAPI,
} from "@excalidraw/excalidraw";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import {
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "@excalidraw/excalidraw/appState";
import {
  CommandPalette,
  DEFAULT_CATEGORIES,
} from "@excalidraw/excalidraw/components/CommandPalette/CommandPalette";
import { ErrorDialog } from "@excalidraw/excalidraw/components/ErrorDialog";
import { OverwriteConfirmDialog } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirm";
import { openConfirmModal } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
import { ShareableLinkDialog } from "@excalidraw/excalidraw/components/ShareableLinkDialog";
import {
  APP_NAME,
  EVENT,
  VERSION_TIMEOUT,
  debounce,
  getVersion,
  getFrame,
  isTestEnv,
  preventUnload,
  resolvablePromise,
  isRunningInIframe,
  isDevEnv,
  DEFAULT_SIDEBAR,
} from "@excalidraw/common";
import polyfill from "@excalidraw/excalidraw/polyfill";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { t } from "@excalidraw/excalidraw/i18n";

import {
  GithubIcon,
  XBrandIcon,
  DiscordIcon,
  ExcalLogo,
  usersIcon,
  exportToPlus,
  share,
  messageCircleIcon,
  youtubeIcon,
} from "@excalidraw/excalidraw/components/icons";
import { Button } from "@excalidraw/excalidraw/components/Button";
import { isElementLink } from "@excalidraw/element";
import {
  bumpElementVersions,
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";
import { newElementWith } from "@excalidraw/element";
import { isInitializedImageElement } from "@excalidraw/element";
import clsx from "clsx";
import {
  parseLibraryTokensFromUrl,
  useHandleLibrary,
} from "@excalidraw/excalidraw/data/library";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type { RestoredDataState } from "@excalidraw/excalidraw/data/restore";
import type {
  FileId,
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
  BinaryFiles,
  ExcalidrawInitialDataState,
  UIAppState,
  ExcalidrawProps,
} from "@excalidraw/excalidraw/types";
import type { ResolutionType } from "@excalidraw/common/utility-types";
import type { ResolvablePromise } from "@excalidraw/common/utils";

import CustomStats from "./CustomStats";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { WorkspaceTitle } from "./components/WorkspaceTitle";
import { KanbanWorkspace } from "./components/KanbanWorkspace";
import { KanbanShareDialog } from "./components/KanbanShareDialog";
import {
  loadKanbanWorkspaceActive,
  loadKanbanBoard,
  loadKanbanBoardAsync,
  saveKanbanBoard,
  saveKanbanWorkspaceActive,
  setKanbanScope,
  type KanbanBoard,
} from "./data/KanbanStore";
import { useDrawsyAuth } from "./auth/useDrawsyAuth";
import { WorkspaceApi } from "./data/WorkspaceApi";
import { WorkspaceSync } from "./data/WorkspaceSync";
import { KanbanApi } from "./data/KanbanApi";
import { PresentationStore } from "./data/PresentationStore";

import {
  KanbanBoardSelectionRequiredError,
  KanbanSync,
  remoteSnapshotToKanbanBoard,
  type KanbanSyncStatus,
} from "./data/KanbanSync";
import {
  WORKSPACE_CLIENT_ID,
  WORKSPACE_SYNC_CHANNEL,
  WorkspaceStore,
  type CanvasDocument,
  type CanvasScene,
  type WorkspaceIndex,
} from "./data/WorkspaceStore";
import {
  Provider,
  useAtom,
  useAtomValue,
  useAtomWithInitialValue,
  appJotaiStore,
} from "./app-jotai";
import {
  FIREBASE_STORAGE_PREFIXES,
  isExcalidrawPlusSignedUser,
  STORAGE_KEYS,
  SAVE_TO_LOCAL_STORAGE_TIMEOUT,
  SYNC_BROWSER_TABS_TIMEOUT,
} from "./app_constants";
import Collab, {
  collabAPIAtom,
  isCollaboratingAtom,
  isOfflineAtom,
} from "./collab/Collab";
import { AppMainMenu } from "./components/AppMainMenu";
import { AppWelcomeScreen } from "./components/AppWelcomeScreen";
import {
  ExportToExcalidrawPlus,
  exportToExcalidrawPlus,
} from "./components/ExportToExcalidrawPlus";
import { TopErrorBoundary } from "./components/TopErrorBoundary";

import {
  exportToBackend,
  getCollaborationLinkData,
  importFromBackend,
  isCollaborationLink,
} from "./data";

import { updateStaleImageStatuses } from "./data/FileManager";
import { FileStatusStore } from "./data/fileStatusStore";
import {
  importFromLocalStorage,
  importUsernameFromLocalStorage,
} from "./data/localStorage";

import { loadFilesFromFirebase } from "./data/firebase";
import {
  LibraryIndexedDBAdapter,
  LibraryLocalStorageMigrationAdapter,
  LocalData,
  localStorageQuotaExceededAtom,
} from "./data/LocalData";
import { isBrowserStorageStateNewer } from "./data/tabSync";
import { ShareDialog, shareDialogStateAtom } from "./share/ShareDialog";
import CollabError, { collabErrorIndicatorAtom } from "./collab/CollabError";
import { useHandleAppTheme } from "./useHandleAppTheme";
import { getPreferredLanguage } from "./app-language/language-detector";
import { useAppLangCode } from "./app-language/language-state";
import DebugCanvas, {
  debugRenderer,
  isVisualDebuggerEnabled,
  loadSavedDebugState,
} from "./components/DebugCanvas";
import { AIComponents } from "./components/AI";
import { ExcalidrawPlusIframeExport } from "./ExcalidrawPlusIframeExport";

import "./index.scss";

import { ExcalidrawPlusPromoBanner } from "./components/ExcalidrawPlusPromoBanner";
import { AppSidebar } from "./components/AppSidebar";
import { CommentDraftBubble } from "./comments/CommentDraftBubble";
import { CommentPins } from "./comments/CommentPins";
import { useCanvasComments } from "./comments/useCanvasComments";

import type { CollabAPI } from "./collab/Collab";
import type { CanvasComment } from "./comments/types";
import type { RemoteKanbanRole } from "./data/KanbanApi";

polyfill();

window.EXCALIDRAW_THROTTLE_RENDER = true;

declare global {
  interface BeforeInstallPromptEventChoiceResult {
    outcome: "accepted" | "dismissed";
  }

  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<BeforeInstallPromptEventChoiceResult>;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let pwaEvent: BeforeInstallPromptEvent | null = null;

// Adding a listener outside of the component as it may (?) need to be
// subscribed early to catch the event.
//
// Also note that it will fire only if certain heuristics are met (user has
// used the app for some time, etc.)
window.addEventListener(
  "beforeinstallprompt",
  (event: BeforeInstallPromptEvent) => {
    // prevent Chrome <= 67 from automatically showing the prompt
    event.preventDefault();
    // cache for later use
    pwaEvent = event;
  },
);

let isSelfEmbedding = false;

if (window.self !== window.top) {
  try {
    const parentUrl = new URL(document.referrer);
    const currentUrl = new URL(window.location.href);
    if (parentUrl.origin === currentUrl.origin) {
      isSelfEmbedding = true;
    }
  } catch (error) {
    // ignore
  }
}

const shareableLinkConfirmDialog = {
  title: "Open shared canvas",
  description: (
    <>
      The shared drawing will open as a <strong>new canvas</strong>.
      <br />
      Your current canvas will remain available in history.
    </>
  ),
  actionLabel: "Open in new canvas",
  color: "warning",
} as const;

const TopRightToolbar = ({
  onShareSelect,
  onCommentSelect,
  isPlacingComment,
  isKanbanOpen,
  onCollabDialogOpen,
}: {
  onShareSelect: () => void;
  onCommentSelect: () => void;
  isPlacingComment: boolean;
  isKanbanOpen: boolean;
  onCollabDialogOpen: () => void;
}) => {
  if (isKanbanOpen) {
    return (
      <>
        <Button
          className="sidebar-trigger default-sidebar-trigger"
          title="Invite"
          aria-label="Invite"
          onSelect={onCollabDialogOpen}
        >
          {usersIcon}
        </Button>
        <ExcalidrawPlusPromoBanner isSignedIn={isExcalidrawPlusSignedUser} />
      </>
    );
  }

  return (
    <>
      <Button
        className="sidebar-trigger default-sidebar-trigger"
        title={t("labels.share")}
        aria-label={t("labels.share")}
        onSelect={onShareSelect}
      >
        {share}
      </Button>
      <Button
        className={clsx("sidebar-trigger", "default-sidebar-trigger", {
          active: isPlacingComment,
        })}
        title="Comments"
        aria-label="Comments"
        onSelect={onCommentSelect}
      >
        {messageCircleIcon}
      </Button>
      <ExcalidrawPlusPromoBanner isSignedIn={isExcalidrawPlusSignedUser} />
    </>
  );
};

const initializeScene = async (opts: {
  collabAPI: CollabAPI | null;
  excalidrawAPI: ExcalidrawImperativeAPI;
}): Promise<
  {
    scene: ExcalidrawInitialDataState | null;
    shouldImportToWorkspace: boolean;
  } & (
    | { isExternalScene: true; id: string; key: string }
    | { isExternalScene: false; id?: null; key?: null }
  )
> => {
  const searchParams = new URLSearchParams(window.location.search);
  const id = searchParams.get("id");
  const jsonBackendMatch = window.location.hash.match(
    /^#json=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)$/,
  );
  const externalUrlMatch = window.location.hash.match(/^#url=(.*)$/);

  const localDataState = importFromLocalStorage();
  let shouldImportToWorkspace = false;

  let scene: Omit<
    RestoredDataState,
    // we're not storing files in the scene database/localStorage, and instead
    // fetch them async from a different store
    "files"
  > & {
    scrollToContent?: boolean;
  } = {
    elements: restoreElements(localDataState?.elements, null, {
      repairBindings: true,
      deleteInvisibleElements: true,
    }),
    appState: restoreAppState(localDataState?.appState, null),
  };

  let roomLinkData = getCollaborationLinkData(window.location.href);
  const isExternalScene = !!(id || jsonBackendMatch || roomLinkData);
  if (isExternalScene) {
    if (
      // don't prompt if scene is empty
      !scene.elements.length ||
      // don't prompt for collab scenes because we don't override local storage
      roomLinkData ||
      // otherwise, prompt whether user wants to override current scene
      (await openConfirmModal(shareableLinkConfirmDialog))
    ) {
      if (jsonBackendMatch) {
        const imported = await importFromBackend(
          jsonBackendMatch[1],
          jsonBackendMatch[2],
        );

        scene = {
          elements: bumpElementVersions(
            restoreElements(imported.elements, null, {
              repairBindings: true,
              deleteInvisibleElements: true,
            }),
            localDataState?.elements,
          ),
          appState: restoreAppState(
            imported.appState,
            // local appState when importing from backend to ensure we restore
            // localStorage user settings which we do not persist on server.
            localDataState?.appState,
          ),
        };
        shouldImportToWorkspace = true;
      }
      scene.scrollToContent = true;
      if (!roomLinkData) {
        window.history.replaceState({}, APP_NAME, window.location.origin);
      }
    } else {
      // https://github.com/excalidraw/excalidraw/issues/1919
      if (document.hidden) {
        return new Promise((resolve, reject) => {
          window.addEventListener(
            "focus",
            () => initializeScene(opts).then(resolve).catch(reject),
            {
              once: true,
            },
          );
        });
      }

      roomLinkData = null;
      window.history.replaceState({}, APP_NAME, window.location.origin);
    }
  } else if (externalUrlMatch) {
    window.history.replaceState({}, APP_NAME, window.location.origin);

    const url = externalUrlMatch[1];
    try {
      const request = await fetch(window.decodeURIComponent(url));
      const data = await loadFromBlob(await request.blob(), null, null);
      if (
        !scene.elements.length ||
        (await openConfirmModal(shareableLinkConfirmDialog))
      ) {
        return {
          scene: data,
          isExternalScene: false,
          shouldImportToWorkspace: true,
        };
      }
    } catch (error: any) {
      return {
        scene: {
          appState: {
            errorMessage: t("alerts.invalidSceneUrl"),
          },
        },
        isExternalScene: false,
        shouldImportToWorkspace: false,
      };
    }
  }

  if (roomLinkData && opts.collabAPI) {
    const { excalidrawAPI } = opts;

    const scene = await opts.collabAPI.startCollaboration(roomLinkData);

    return {
      // when collaborating, the state may have already been updated at this
      // point (we may have received updates from other clients), so reconcile
      // elements and appState with existing state
      scene: {
        ...scene,
        appState: {
          ...restoreAppState(
            {
              ...scene?.appState,
              theme: localDataState?.appState?.theme || scene?.appState?.theme,
            },
            excalidrawAPI.getAppState(),
          ),
          // necessary if we're invoking from a hashchange handler which doesn't
          // go through App.initializeScene() that resets this flag
          isLoading: false,
        },
        elements: reconcileElements(
          scene?.elements || [],
          excalidrawAPI.getSceneElementsIncludingDeleted() as RemoteExcalidrawElement[],
          excalidrawAPI.getAppState(),
        ),
      },
      isExternalScene: true,
      id: roomLinkData.roomId,
      key: roomLinkData.roomKey,
      shouldImportToWorkspace: false,
    };
  } else if (scene) {
    return shouldImportToWorkspace && jsonBackendMatch
      ? {
          scene,
          isExternalScene: true,
          id: jsonBackendMatch[1],
          key: jsonBackendMatch[2],
          shouldImportToWorkspace,
        }
      : {
          scene,
          isExternalScene: false,
          shouldImportToWorkspace: false,
        };
  }
  return {
    scene: null,
    isExternalScene: false,
    shouldImportToWorkspace: false,
  };
};

const getWorkspaceSceneFingerprint = (
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
) =>
  JSON.stringify({
    elements: elements.map((element) => [
      element.id,
      element.version,
      element.versionNonce,
      element.isDeleted,
    ]),
    appState: clearAppStateForLocalStorage(appState),
    files: Object.values(files)
      .map((file) => [file.id, file.version])
      .sort(([firstId], [secondId]) =>
        String(firstId).localeCompare(String(secondId)),
      ),
  });

const WORKSPACE_SYNC_IDLE_TIMEOUT = 3000;
const WORKSPACE_SYNC_RETRY_TIMEOUT = 5000;

const ExcalidrawWrapper = () => {
  const excalidrawAPI = useExcalidrawAPI();
  const drawsyAuth = useDrawsyAuth();
  const workspaceSync = useMemo(
    () =>
      drawsyAuth.user
        ? new WorkspaceSync(new WorkspaceApi(drawsyAuth.getIdToken))
        : null,
    [drawsyAuth.getIdToken, drawsyAuth.user],
  );
  const kanbanApi = useMemo(
    () => (drawsyAuth.user ? new KanbanApi(drawsyAuth.getIdToken) : null),
    [drawsyAuth.getIdToken, drawsyAuth.user],
  );

  const [errorMessage, setErrorMessage] = useState("");
  const [workspaceSyncStatus, setWorkspaceSyncStatus] = useState<
    "local" | "pending" | "syncing" | "synced" | "error"
  >("local");
  const [workspaceSyncRetry, setWorkspaceSyncRetry] = useState(0);
  const isCollabDisabled = isRunningInIframe();

  const { editorTheme, appTheme, setAppTheme } = useHandleAppTheme();

  const [langCode, setLangCode] = useAppLangCode();

  // initial state
  // ---------------------------------------------------------------------------

  const initialStatePromiseRef = useRef<{
    promise: ResolvablePromise<ExcalidrawInitialDataState | null>;
  }>({ promise: null! });
  if (!initialStatePromiseRef.current.promise) {
    initialStatePromiseRef.current.promise =
      resolvablePromise<ExcalidrawInitialDataState | null>();
  }

  const debugCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    trackEvent("load", "frame", getFrame());
    // Delayed so that the app has a time to load the latest SW
    setTimeout(() => {
      trackEvent("load", "version", getVersion());
    }, VERSION_TIMEOUT);
  }, []);

  const [, setShareDialogState] = useAtom(shareDialogStateAtom);
  const [collabAPI] = useAtom(collabAPIAtom);
  const [isCollaborating] = useAtomWithInitialValue(isCollaboratingAtom, () => {
    return isCollaborationLink(window.location.href);
  });
  const collabError = useAtomValue(collabErrorIndicatorAtom);

  useHandleLibrary({
    excalidrawAPI,
    adapter: LibraryIndexedDBAdapter,
    // TODO maybe remove this in several months (shipped: 24-03-11)
    migrationAdapter: LibraryLocalStorageMigrationAdapter,
  });

  const [, forceRefresh] = useState(false);
  const [workspaceIndex, setWorkspaceIndex] = useState<WorkspaceIndex | null>(
    null,
  );
  const workspaceIndexRef = useRef<WorkspaceIndex | null>(null);
  const workspaceOperationRef = useRef<Promise<void>>(Promise.resolve());
  const workspaceSaveTimerRef = useRef<number | null>(null);
  const workspaceSyncTimerRef = useRef<number | null>(null);
  const workspaceSyncRetryTimerRef = useRef<number | null>(null);
  const workspaceSyncInFlightRef = useRef<Promise<void> | null>(null);
  const workspaceSceneFingerprintsRef = useRef(new Map<string, string>());
  const workspaceSwitchingRef = useRef(false);
  const workspaceScopeRef = useRef<string | null | undefined>(undefined);
  const initialWorkspaceLoadStartedRef = useRef(false);
  const [initialWorkspaceLoadComplete, setInitialWorkspaceLoadComplete] =
    useState(false);
  const [projectTitleToFocus, setProjectTitleToFocus] = useState<string | null>(
    null,
  );
  const [loadingCanvasId, setLoadingCanvasId] = useState<string | null>(null);
  const [commentsSidebarOpen, setCommentsSidebarOpen] = useState(false);
  const [kanbanBoard, setKanbanBoard] = useState<KanbanBoard>(() =>
    loadKanbanBoard(),
  );
  const kanbanBoardRef = useRef(kanbanBoard);
  const kanbanSyncRef = useRef<KanbanSync | null>(null);
  const [kanbanBoardReady, setKanbanBoardReady] = useState(false);
  const [kanbanLoadedScope, setKanbanLoadedScope] = useState<string | null>(
    null,
  );
  const [kanbanSyncStatus, setKanbanSyncStatus] =
    useState<KanbanSyncStatus>("local");
  const [kanbanRole, setKanbanRole] = useState<RemoteKanbanRole | null>(null);
  const [kanbanShareOpen, setKanbanShareOpen] = useState(false);
  const [kanbanSyncGeneration, setKanbanSyncGeneration] = useState(0);
  const [kanbanInvitationToken, setKanbanInvitationToken] = useState(() => {
    const match = window.location.hash.match(/(?:^#|&)kanban-invite=([^&]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  });
  const [kanbanOpen, setKanbanOpen] = useState(() =>
    loadKanbanWorkspaceActive(),
  );
  const [presentationCanvasOpen, setPresentationCanvasOpen] = useState(() =>
    PresentationStore.loadActive(),
  );
  const presentationCanvasOpenRef = useRef(presentationCanvasOpen);
  const presentationLoadingWorkspaceRef = useRef(false);
  const presentationSceneRef = useRef<CanvasScene | null>(null);

  useEffect(() => {
    if (kanbanInvitationToken && drawsyAuth.status === "anonymous") {
      setErrorMessage(
        "Sign in with the invited email to join this Kanban board.",
      );
    }
  }, [drawsyAuth.status, kanbanInvitationToken]);

  const updateKanbanBoard = useCallback((board: KanbanBoard) => {
    kanbanBoardRef.current = board;
    setKanbanBoard(board);
    void saveKanbanBoard(board).catch(() => {
      setKanbanSyncStatus("error");
      setErrorMessage("Kanban changes couldn't be saved in this browser.");
    });
    kanbanSyncRef.current?.queue(board);
  }, []);

  useEffect(() => {
    if (drawsyAuth.status === "loading") {
      setKanbanBoardReady(false);
      setKanbanLoadedScope(null);
      return;
    }
    let active = true;
    setKanbanBoardReady(false);
    const scopeUserId = drawsyAuth.user?.uid || null;
    setKanbanLoadedScope(null);
    setKanbanScope(scopeUserId);
    void loadKanbanBoardAsync().then((board) => {
      if (!active) {
        return;
      }
      kanbanBoardRef.current = board;
      setKanbanBoard(board);
      setKanbanLoadedScope(scopeUserId || "guest");
      setKanbanBoardReady(true);
    });
    return () => {
      active = false;
    };
  }, [drawsyAuth.status, drawsyAuth.user?.uid]);

  useEffect(() => {
    if (
      !kanbanBoardReady ||
      !kanbanOpen ||
      drawsyAuth.status !== "authenticated" ||
      !drawsyAuth.user ||
      !kanbanApi ||
      kanbanLoadedScope !== drawsyAuth.user.uid
    ) {
      kanbanSyncRef.current?.stop();
      kanbanSyncRef.current = null;
      setKanbanSyncStatus("local");
      setKanbanRole(null);
      return;
    }

    let active = true;
    const sync = new KanbanSync(
      kanbanApi,
      (board) => {
        if (!active) {
          return;
        }
        kanbanBoardRef.current = board;
        setKanbanBoard(board);
        void saveKanbanBoard(board).catch(() => {
          setKanbanSyncStatus("error");
          setErrorMessage("Kanban changes couldn't be saved in this browser.");
        });
      },
      setKanbanSyncStatus,
      setKanbanRole,
    );
    kanbanSyncRef.current = sync;
    void sync
      .initialize(drawsyAuth.user.uid, kanbanBoardRef.current)
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setKanbanSyncStatus("error");
        setErrorMessage(
          error instanceof KanbanBoardSelectionRequiredError
            ? error.message
            : "Couldn't sync the Kanban board. Local changes remain saved.",
        );
      });

    return () => {
      active = false;
      sync.stop();
      if (kanbanSyncRef.current === sync) {
        kanbanSyncRef.current = null;
      }
    };
  }, [
    drawsyAuth.getIdToken,
    drawsyAuth.status,
    drawsyAuth.user,
    kanbanApi,
    kanbanBoardReady,
    kanbanLoadedScope,
    kanbanOpen,
    kanbanSyncGeneration,
  ]);

  const clearKanbanInvitation = useCallback(() => {
    setKanbanInvitationToken(null);
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState(null, "", url);
  }, []);

  const openAcceptedKanbanBoard = useCallback(
    async (boardId: string) => {
      if (!kanbanApi) {
        return;
      }
      const snapshot = await kanbanApi.getSnapshot(boardId);
      const board = remoteSnapshotToKanbanBoard(snapshot);
      kanbanSyncRef.current?.stop();
      kanbanBoardRef.current = board;
      setKanbanBoard(board);
      setKanbanRole(snapshot.board.role);
      await saveKanbanBoard(board);
      clearKanbanInvitation();
      setKanbanOpen(true);
      saveKanbanWorkspaceActive(true);
      window.dispatchEvent(new CustomEvent("kanbanToggle", { detail: true }));
      setKanbanSyncGeneration((value) => value + 1);
    },
    [clearKanbanInvitation, kanbanApi],
  );

  const setKanbanWorkspaceActive = useCallback((active: boolean) => {
    setKanbanOpen(active);
    saveKanbanWorkspaceActive(active);
    window.dispatchEvent(new CustomEvent("kanbanToggle", { detail: active }));
  }, []);

  const setPresentationCanvasActive = useCallback((active: boolean) => {
    presentationCanvasOpenRef.current = active;
    PresentationStore.saveActive(active);
    setPresentationCanvasOpen(active);
  }, []);

  useEffect(() => {
    const disabledSurfaces = document.querySelectorAll<HTMLElement>(
      ".layer-ui__wrapper__footer",
    );
    disabledSurfaces.forEach((element) => {
      element.inert = kanbanOpen;
      if (kanbanOpen) {
        element.setAttribute("aria-disabled", "true");
      } else {
        element.removeAttribute("aria-disabled");
      }
    });
    return () => disabledSurfaces.forEach((element) => (element.inert = false));
  }, [kanbanOpen]);

  const commitWorkspaceIndex = useCallback((index: WorkspaceIndex) => {
    workspaceIndexRef.current = index;
    setWorkspaceIndex(index);
  }, []);

  const queueWorkspaceOperation = useCallback(
    <T,>(operation: () => Promise<T>): Promise<T> => {
      const result = workspaceOperationRef.current.then(operation, operation);
      workspaceOperationRef.current = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    [],
  );

  const saveWorkspaceCanvas = useCallback(
    async (
      canvasId: string,
      elements: readonly OrderedExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      if (presentationCanvasOpenRef.current) {
        return;
      }

      const fingerprint = getWorkspaceSceneFingerprint(
        elements,
        appState,
        files,
      );
      if (workspaceSceneFingerprintsRef.current.get(canvasId) === fingerprint) {
        return;
      }
      workspaceSceneFingerprintsRef.current.set(canvasId, fingerprint);

      try {
        await queueWorkspaceOperation(async () => {
          const index = workspaceIndexRef.current;
          if (!index) {
            return;
          }
          const nextIndex = await WorkspaceStore.saveCanvas(index, canvasId, {
            elements,
            appState,
            files,
          });
          commitWorkspaceIndex(nextIndex);
          if (nextIndex.activeCanvasId !== index.activeCanvasId) {
            const preserved = nextIndex.canvases.find(
              (canvas) => canvas.id === nextIndex.activeCanvasId,
            );
            if (preserved) {
              excalidrawAPI?.updateScene({
                appState: { name: preserved.title },
                captureUpdate: CaptureUpdateAction.NEVER,
              });
              excalidrawAPI?.setToast({
                message: "Concurrent tab edits were preserved separately.",
              });
            }
          }
        });
      } catch (error) {
        if (
          workspaceSceneFingerprintsRef.current.get(canvasId) === fingerprint
        ) {
          workspaceSceneFingerprintsRef.current.delete(canvasId);
        }
        throw error;
      }
    },
    [commitWorkspaceIndex, excalidrawAPI, queueWorkspaceOperation],
  );

  useEffect(() => {
    if (isDevEnv()) {
      const debugState = loadSavedDebugState();

      if (debugState.enabled && !window.visualDebug) {
        window.visualDebug = {
          data: [],
        };
      } else {
        delete window.visualDebug;
      }
      forceRefresh((prev) => !prev);
    }
  }, [excalidrawAPI]);

  // ---------------------------------------------------------------------------
  // Hoisted loadImages
  // ---------------------------------------------------------------------------
  const loadImages = useCallback(
    (data: ResolutionType<typeof initializeScene>, isInitialLoad = false) => {
      if (!data.scene || !excalidrawAPI) {
        return;
      }

      if (collabAPI?.isCollaborating()) {
        if (data.scene.elements) {
          collabAPI
            .fetchImageFilesFromFirebase({
              elements: data.scene.elements,
              forceFetchFiles: true,
            })
            .then(({ loadedFiles, erroredFiles }) => {
              excalidrawAPI.addFiles(loadedFiles);
              updateStaleImageStatuses({
                excalidrawAPI,
                erroredFiles,
                elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
              });
            });
        }
      } else {
        const fileIds =
          data.scene.elements?.reduce((acc, element) => {
            if (isInitializedImageElement(element)) {
              return acc.concat(element.fileId);
            }
            return acc;
          }, [] as FileId[]) || [];

        if (data.isExternalScene) {
          if (fileIds.length) {
            // Direct Firebase call (not through FileManager), so track manually
            FileStatusStore.updateStatuses(
              fileIds.map((id) => [id, "loading"]),
            );
          }
          loadFilesFromFirebase(
            `${FIREBASE_STORAGE_PREFIXES.shareLinkFiles}/${data.id}`,
            data.key,
            fileIds,
          ).then(({ loadedFiles, erroredFiles }) => {
            excalidrawAPI.addFiles(loadedFiles);
            updateStaleImageStatuses({
              excalidrawAPI,
              erroredFiles,
              elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
            });
            FileStatusStore.updateStatuses([
              ...loadedFiles.map((f) => [f.id, "loaded"] as [FileId, "loaded"]),
              ...[...erroredFiles.keys()].map(
                (id) => [id, "error"] as [FileId, "error"],
              ),
            ]);
          });
        } else if (isInitialLoad) {
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(async ({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
          // on fresh load, clear unused files from IDB (from previous
          // session)
          LocalData.fileStorage.clearObsoleteFiles({
            currentFileIds: fileIds,
          });
        }
      }
    },
    [collabAPI, excalidrawAPI],
  );

  const prepareWorkspaceScene = useCallback(
    async (data: ResolutionType<typeof initializeScene>) => {
      if (
        !data.scene ||
        (data.isExternalScene && !data.shouldImportToWorkspace)
      ) {
        return;
      }

      try {
        WorkspaceStore.setScope(drawsyAuth.user?.uid || null);
        workspaceScopeRef.current = drawsyAuth.user?.uid || null;
        const isPresentationRefresh = presentationCanvasOpenRef.current;
        const workspaceInitialScene: CanvasScene = isPresentationRefresh
          ? {
              elements: [],
              appState: {
                ...getDefaultAppState(),
                name: "Untitled",
              },
              files: {},
            }
          : data.scene;
        let workspace = workspaceSync
          ? await workspaceSync.initialize(
              drawsyAuth.user!.uid,
              workspaceInitialScene,
            )
          : await WorkspaceStore.initialize(workspaceInitialScene);
        if (
          !isPresentationRefresh &&
          data.shouldImportToWorkspace &&
          !workspace.isNewWorkspace
        ) {
          workspace = {
            ...(await WorkspaceStore.importCanvas(data.scene)),
            isNewWorkspace: false,
          };
        }
        commitWorkspaceIndex(workspace.index);
        setWorkspaceSyncStatus(workspaceSync ? "synced" : "local");
        if (isPresentationRefresh) {
          const presentationScene = (await PresentationStore.loadScene()) || {
            elements: [],
            appState: {
              ...getDefaultAppState(),
              name: "Presentation",
            },
            files: {},
          };
          presentationSceneRef.current = presentationScene;
          data.scene = presentationScene;
        } else {
          data.scene = workspace.document.scene;
        }

        const restoredElements = restoreElements(
          workspace.document.scene.elements,
          null,
          { repairBindings: true },
        );
        const restoredAppState = {
          ...restoreAppState(workspace.document.scene.appState, null),
          isLoading: false,
          openMenu: null,
        };
        const files = workspace.document.scene.files || {};

        workspaceSceneFingerprintsRef.current.set(
          workspace.document.id,
          getWorkspaceSceneFingerprint(
            restoredElements,
            restoredAppState,
            files,
          ),
        );
      } catch (error) {
        console.error("Failed to initialize workspace storage", error);
        setWorkspaceSyncStatus("error");
        WorkspaceStore.setScope(drawsyAuth.user?.uid || null);
        if (drawsyAuth.user && !(await WorkspaceStore.hasWorkspace())) {
          await WorkspaceStore.seedFromGuest();
        }
        const fallbackScene: CanvasScene = presentationCanvasOpenRef.current
          ? {
              elements: [],
              appState: {
                ...getDefaultAppState(),
                name: "Untitled",
              },
              files: {},
            }
          : data.scene;
        const fallback = await WorkspaceStore.initialize(fallbackScene);
        workspaceScopeRef.current = drawsyAuth.user?.uid || null;
        commitWorkspaceIndex(fallback.index);
        data.scene = presentationCanvasOpenRef.current
          ? (await PresentationStore.loadScene()) || {
              elements: [],
              appState: {
                ...getDefaultAppState(),
                name: "Presentation",
              },
              files: {},
            }
          : fallback.document.scene;
      }
    },
    [commitWorkspaceIndex, drawsyAuth.user, workspaceSync],
  );

  useEffect(() => {
    if (
      !excalidrawAPI ||
      (!isCollabDisabled && !collabAPI) ||
      drawsyAuth.status === "loading"
    ) {
      return;
    }
    if (!initialWorkspaceLoadStartedRef.current) {
      initialWorkspaceLoadStartedRef.current = true;
      initializeScene({ collabAPI, excalidrawAPI }).then(async (data) => {
        await prepareWorkspaceScene(data);
        loadImages(data, /* isInitialLoad */ true);
        initialStatePromiseRef.current.promise.resolve(data.scene);
        setInitialWorkspaceLoadComplete(true);
      });
    }

    const onHashChange = async (event: HashChangeEvent) => {
      event.preventDefault();
      const libraryUrlTokens = parseLibraryTokensFromUrl();
      if (!libraryUrlTokens) {
        if (
          collabAPI?.isCollaborating() &&
          !isCollaborationLink(window.location.href)
        ) {
          collabAPI.stopCollaboration(false);
        }
        excalidrawAPI.updateScene({ appState: { isLoading: true } });

        initializeScene({ collabAPI, excalidrawAPI }).then(async (data) => {
          await prepareWorkspaceScene(data);
          loadImages(data);
          if (data.scene) {
            LocalData.pauseSave("workspace-switch");
            try {
              excalidrawAPI.resetScene({ resetLoadingState: true });
              excalidrawAPI.updateScene({
                elements: restoreElements(data.scene.elements, null, {
                  repairBindings: true,
                }),
                appState: restoreAppState(data.scene.appState, null),
                captureUpdate: CaptureUpdateAction.NEVER,
              });
              excalidrawAPI.replaceFiles(data.scene.files || {});
              excalidrawAPI.history.clear();
            } finally {
              LocalData.resumeSave("workspace-switch");
            }
          }
        });
      }
    };

    const syncData = debounce(() => {
      if (isTestEnv()) {
        return;
      }
      if (
        !document.hidden &&
        ((collabAPI && !collabAPI.isCollaborating()) || isCollabDisabled)
      ) {
        // don't sync if local state is newer or identical to browser state
        if (
          !presentationCanvasOpenRef.current &&
          isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)
        ) {
          const localDataState = importFromLocalStorage();
          const username = importUsernameFromLocalStorage();
          setLangCode(getPreferredLanguage());
          excalidrawAPI.updateScene({
            ...localDataState,
            captureUpdate: CaptureUpdateAction.NEVER,
          });
          LibraryIndexedDBAdapter.load().then((data) => {
            if (data) {
              excalidrawAPI.updateLibrary({
                libraryItems: data.libraryItems,
              });
            }
          });
          collabAPI?.setUsername(username || "");
        }

        if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_FILES)) {
          const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
          const currFiles = excalidrawAPI.getFiles();
          const fileIds =
            elements?.reduce((acc, element) => {
              if (
                isInitializedImageElement(element) &&
                // only load and update images that aren't already loaded
                !currFiles[element.fileId]
              ) {
                return acc.concat(element.fileId);
              }
              return acc;
            }, [] as FileId[]) || [];
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
        }
      }
    }, SYNC_BROWSER_TABS_TIMEOUT);

    const onUnload = () => {
      if (presentationCanvasOpenRef.current) {
        void PresentationStore.flushSave(presentationSceneRef.current);
        return;
      }
      LocalData.flushSave();
    };

    const visibilityChange = (event: FocusEvent | Event) => {
      if (event.type === EVENT.BLUR || document.hidden) {
        if (presentationCanvasOpenRef.current) {
          void PresentationStore.flushSave(presentationSceneRef.current);
        } else {
          LocalData.flushSave();
        }
      }
      if (
        event.type === EVENT.VISIBILITY_CHANGE ||
        event.type === EVENT.FOCUS
      ) {
        syncData();
      }
    };

    window.addEventListener(EVENT.HASHCHANGE, onHashChange, false);
    window.addEventListener(EVENT.UNLOAD, onUnload, false);
    window.addEventListener(EVENT.BLUR, visibilityChange, false);
    document.addEventListener(EVENT.VISIBILITY_CHANGE, visibilityChange, false);
    window.addEventListener(EVENT.FOCUS, visibilityChange, false);
    return () => {
      window.removeEventListener(EVENT.HASHCHANGE, onHashChange, false);
      window.removeEventListener(EVENT.UNLOAD, onUnload, false);
      window.removeEventListener(EVENT.BLUR, visibilityChange, false);
      window.removeEventListener(EVENT.FOCUS, visibilityChange, false);
      document.removeEventListener(
        EVENT.VISIBILITY_CHANGE,
        visibilityChange,
        false,
      );
    };
  }, [
    isCollabDisabled,
    collabAPI,
    excalidrawAPI,
    setLangCode,
    loadImages,
    commitWorkspaceIndex,
    prepareWorkspaceScene,
    drawsyAuth.status,
  ]);

  useEffect(() => {
    const unloadHandler = (event: BeforeUnloadEvent) => {
      if (presentationCanvasOpenRef.current) {
        void PresentationStore.flushSave(presentationSceneRef.current);
      } else {
        LocalData.flushSave();
      }

      if (
        excalidrawAPI &&
        LocalData.fileStorage.shouldPreventUnload(
          excalidrawAPI.getSceneElements(),
        )
      ) {
        if (import.meta.env.VITE_APP_DISABLE_PREVENT_UNLOAD !== "true") {
          preventUnload(event);
        } else {
          console.warn(
            "preventing unload disabled (VITE_APP_DISABLE_PREVENT_UNLOAD)",
          );
        }
      }
    };
    window.addEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    return () => {
      window.removeEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    };
  }, [excalidrawAPI]);

  const onChange = (
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    if (presentationCanvasOpenRef.current) {
      if (!presentationLoadingWorkspaceRef.current) {
        const scene = {
          elements,
          appState,
          files,
        };
        presentationSceneRef.current = scene;
        PresentationStore.saveScene(scene);
      }
      return;
    }

    if (collabAPI?.isCollaborating()) {
      collabAPI.syncElements(elements);
    }

    // this check is redundant, but since this is a hot path, it's best
    // not to evaludate the nested expression every time
    if (!LocalData.isSavePaused()) {
      LocalData.save(elements, appState, files, () => {
        if (excalidrawAPI) {
          let didChange = false;

          const elements = excalidrawAPI
            .getSceneElementsIncludingDeleted()
            .map((element) => {
              if (
                LocalData.fileStorage.shouldUpdateImageElementStatus(element)
              ) {
                const newElement = newElementWith(element, { status: "saved" });
                if (newElement !== element) {
                  didChange = true;
                }
                return newElement;
              }
              return element;
            });

          if (didChange) {
            excalidrawAPI.updateScene({
              elements,
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }
        }
      });
    }

    const activeCanvasId = workspaceIndexRef.current?.activeCanvasId;
    if (activeCanvasId && !collabAPI?.isCollaborating()) {
      if (workspaceSaveTimerRef.current !== null) {
        window.clearTimeout(workspaceSaveTimerRef.current);
      }
      workspaceSaveTimerRef.current = window.setTimeout(() => {
        workspaceSaveTimerRef.current = null;
        void saveWorkspaceCanvas(activeCanvasId, elements, appState, files);
      }, SAVE_TO_LOCAL_STORAGE_TIMEOUT);
    }

    // Render the debug scene if the debug canvas is available
    if (debugCanvasRef.current && excalidrawAPI) {
      debugRenderer(
        debugCanvasRef.current,
        appState,
        elements,
        window.devicePixelRatio,
      );
    }
  };

  useEffect(
    () => () => {
      if (workspaceSaveTimerRef.current !== null) {
        window.clearTimeout(workspaceSaveTimerRef.current);
      }
      if (workspaceSyncRetryTimerRef.current !== null) {
        window.clearTimeout(workspaceSyncRetryTimerRef.current);
      }
    },
    [],
  );

  const createBlankScene = useCallback((): CanvasScene => {
    const currentAppState = excalidrawAPI?.getAppState();
    return {
      elements: [],
      appState: {
        ...getDefaultAppState(),
        theme: currentAppState?.theme || getDefaultAppState().theme,
        name: "Untitled",
        isLoading: false,
        openMenu: null,
      },
      files: {},
    };
  }, [excalidrawAPI]);

  const openPresentationCanvas = useCallback(async () => {
    if (!excalidrawAPI) {
      return;
    }

    const activeCanvasId = workspaceIndexRef.current?.activeCanvasId;
    if (activeCanvasId && !collabAPI?.isCollaborating()) {
      if (workspaceSaveTimerRef.current !== null) {
        window.clearTimeout(workspaceSaveTimerRef.current);
        workspaceSaveTimerRef.current = null;
      }
      try {
        LocalData.flushSave();
        await saveWorkspaceCanvas(
          activeCanvasId,
          excalidrawAPI.getSceneElementsIncludingDeleted(),
          excalidrawAPI.getAppState(),
          excalidrawAPI.getFiles(),
        );
      } catch {
        setErrorMessage(
          "Couldn't save the current canvas before presentation.",
        );
        return;
      }
    }

    const blankScene = createBlankScene();
    const scene = presentationSceneRef.current ||
      (await PresentationStore.loadScene()) || {
        ...blankScene,
        appState: {
          ...blankScene.appState,
          name: "Presentation",
        },
      };
    presentationSceneRef.current = scene;
    PresentationStore.saveScene(scene);

    setPresentationCanvasActive(true);
    LocalData.pauseSave("workspace-switch");
    try {
      excalidrawAPI.resetScene({ resetLoadingState: true });
      excalidrawAPI.updateScene({
        elements: restoreElements(scene.elements, null, {
          repairBindings: true,
        }),
        appState: {
          ...restoreAppState(scene.appState, null),
          name: "Presentation",
          isLoading: false,
          openMenu: null,
          openSidebar: null,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      excalidrawAPI.replaceFiles(scene.files || {});
      excalidrawAPI.history.clear();
    } finally {
      LocalData.resumeSave("workspace-switch");
    }
  }, [
    collabAPI,
    createBlankScene,
    excalidrawAPI,
    saveWorkspaceCanvas,
    setPresentationCanvasActive,
  ]);

  const applyWorkspaceDocument = useCallback(
    (document: CanvasDocument) => {
      if (!excalidrawAPI || !document) {
        return;
      }

      LocalData.pauseSave("workspace-switch");
      try {
        const restoredElements = restoreElements(
          document.scene.elements,
          null,
          {
            repairBindings: true,
          },
        );
        const restoredAppState = {
          ...restoreAppState(document.scene.appState, null),
          isLoading: false,
          openMenu: null,
        };
        const files = document.scene.files || {};

        workspaceSceneFingerprintsRef.current.set(
          document.id,
          getWorkspaceSceneFingerprint(
            restoredElements,
            restoredAppState,
            files,
          ),
        );

        excalidrawAPI.resetScene({ resetLoadingState: true });
        excalidrawAPI.updateScene({
          elements: restoredElements,
          appState: restoredAppState,
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        excalidrawAPI.replaceFiles(files);
        excalidrawAPI.history.clear();
      } finally {
        LocalData.resumeSave("workspace-switch");
      }
    },
    [excalidrawAPI],
  );

  const runWorkspaceSwitch = useCallback(
    async (
      operation: (index: WorkspaceIndex) => Promise<{
        index: WorkspaceIndex;
        document?: CanvasDocument;
        usedCachedScene?: boolean;
      } | null>,
    ) => {
      if (!excalidrawAPI || collabAPI?.isCollaborating()) {
        excalidrawAPI?.setToast({
          message: "Leave collaboration before switching canvases.",
        });
        return null;
      }

      if (workspaceSaveTimerRef.current !== null) {
        window.clearTimeout(workspaceSaveTimerRef.current);
        workspaceSaveTimerRef.current = null;
      }

      const wasPresentationCanvasOpen = presentationCanvasOpenRef.current;
      presentationLoadingWorkspaceRef.current = wasPresentationCanvasOpen;
      try {
        return await queueWorkspaceOperation(async () => {
          let index = workspaceIndexRef.current;
          if (!index) {
            return null;
          }

          if (!presentationCanvasOpenRef.current) {
            LocalData.flushSave();
            const activeCanvasId = index.activeCanvasId;
            const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
            const appState = excalidrawAPI.getAppState();
            const files = excalidrawAPI.getFiles();
            const fingerprint = getWorkspaceSceneFingerprint(
              elements,
              appState,
              files,
            );

            if (
              workspaceSceneFingerprintsRef.current.get(activeCanvasId) !==
              fingerprint
            ) {
              index = await WorkspaceStore.saveCanvas(index, activeCanvasId, {
                elements,
                appState,
                files,
              });
              workspaceSceneFingerprintsRef.current.set(
                activeCanvasId,
                fingerprint,
              );
            }
          }

          const result = await operation(index);
          if (!result) {
            commitWorkspaceIndex(index);
            return null;
          }
          commitWorkspaceIndex(result.index);
          if (result.document) {
            applyWorkspaceDocument(result.document);
          }
          return result;
        });
      } catch (error) {
        console.error("Workspace operation failed", error);
        excalidrawAPI.setToast({
          message:
            "Couldn't complete that action. Your current canvas is safe.",
        });
        return null;
      } finally {
        presentationLoadingWorkspaceRef.current = false;
      }
    },
    [
      applyWorkspaceDocument,
      collabAPI,
      commitWorkspaceIndex,
      excalidrawAPI,
      queueWorkspaceOperation,
    ],
  );

  useEffect(() => {
    const nextScope = drawsyAuth.user?.uid || null;
    const previousScope = workspaceScopeRef.current || null;
    if (
      !initialWorkspaceLoadComplete ||
      drawsyAuth.status === "loading" ||
      workspaceScopeRef.current === nextScope ||
      !excalidrawAPI ||
      collabAPI?.isCollaborating()
    ) {
      return;
    }

    void queueWorkspaceOperation(async () => {
      await workspaceSyncInFlightRef.current;
      const currentIndex = workspaceIndexRef.current;
      if (currentIndex && !presentationCanvasOpenRef.current) {
        await WorkspaceStore.saveCanvas(
          currentIndex,
          currentIndex.activeCanvasId,
          {
            elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
            appState: excalidrawAPI.getAppState(),
            files: excalidrawAPI.getFiles(),
          },
        );
      }

      const currentScene: CanvasScene = {
        elements: presentationCanvasOpenRef.current
          ? []
          : excalidrawAPI.getSceneElementsIncludingDeleted(),
        appState: presentationCanvasOpenRef.current
          ? {
              ...getDefaultAppState(),
              name: "Untitled",
            }
          : excalidrawAPI.getAppState(),
        files: presentationCanvasOpenRef.current
          ? {}
          : excalidrawAPI.getFiles(),
      };
      setWorkspaceSyncStatus(workspaceSync ? "syncing" : "local");
      WorkspaceStore.setScope(nextScope);
      const workspace =
        workspaceSync && drawsyAuth.user
          ? await workspaceSync.initialize(drawsyAuth.user.uid, currentScene)
          : await WorkspaceStore.initialize(currentScene);
      workspaceScopeRef.current = nextScope;
      workspaceSceneFingerprintsRef.current.clear();
      commitWorkspaceIndex(workspace.index);
      applyWorkspaceDocument(workspace.document);
      setWorkspaceSyncStatus(workspaceSync ? "synced" : "local");
    }).catch((error) => {
      WorkspaceStore.setScope(previousScope);
      console.error("Failed to switch workspace account", error);
      setWorkspaceSyncStatus("error");
      setErrorMessage("Couldn't load your Drawsy workspace.");
    });
  }, [
    applyWorkspaceDocument,
    collabAPI,
    commitWorkspaceIndex,
    drawsyAuth.status,
    drawsyAuth.user,
    excalidrawAPI,
    initialWorkspaceLoadComplete,
    queueWorkspaceOperation,
    workspaceSync,
  ]);

  const syncWorkspaceNow = useCallback(
    async (flushEditor = false, pullRemote = false) => {
      if (
        !workspaceSync ||
        !drawsyAuth.user ||
        workspaceScopeRef.current !== drawsyAuth.user.uid ||
        collabAPI?.isCollaborating()
      ) {
        return;
      }
      if (flushEditor && excalidrawAPI && !presentationCanvasOpenRef.current) {
        LocalData.flushSave();
        const canvasId = workspaceIndexRef.current?.activeCanvasId;
        if (canvasId) {
          await saveWorkspaceCanvas(
            canvasId,
            excalidrawAPI.getSceneElementsIncludingDeleted(),
            excalidrawAPI.getAppState(),
            excalidrawAPI.getFiles(),
          );
        }
      }
      if (workspaceSyncInFlightRef.current) {
        return workspaceSyncInFlightRef.current;
      }

      const sync = async () => {
        const currentIndex = workspaceIndexRef.current;
        if (!currentIndex) {
          return;
        }
        setWorkspaceSyncStatus("syncing");
        const previousActive = currentIndex.canvases.find(
          (canvas) => canvas.id === currentIndex.activeCanvasId,
        );
        const synchronized = pullRemote
          ? await workspaceSync.synchronize(currentIndex)
          : {
              index: await workspaceSync.push(currentIndex),
              document: undefined,
            };
        const syncedIndex = synchronized.index;
        commitWorkspaceIndex(syncedIndex);
        if (synchronized.document) {
          const contentChanged =
            synchronized.document.id !== previousActive?.id ||
            synchronized.document.sync.remoteContentHash !==
              previousActive.sync.remoteContentHash;
          if (contentChanged) {
            applyWorkspaceDocument(synchronized.document);
          } else if (synchronized.document.title !== previousActive.title) {
            excalidrawAPI?.updateScene({
              appState: { name: synchronized.document.title },
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }
        }
        const stillDirty =
          syncedIndex.pendingDeletes.length > 0 ||
          syncedIndex.projects.some((project) => project.sync.dirty) ||
          syncedIndex.canvases.some((canvas) => canvas.sync.dirty);
        setWorkspaceSyncStatus(stillDirty ? "pending" : "synced");
        if (workspaceSyncRetryTimerRef.current !== null) {
          window.clearTimeout(workspaceSyncRetryTimerRef.current);
          workspaceSyncRetryTimerRef.current = null;
        }
      };

      const operation = sync()
        .catch((error) => {
          console.error("Workspace sync failed", error);
          setWorkspaceSyncStatus("error");
          excalidrawAPI?.setToast({
            message: "Workspace saved locally. Cloud sync will retry.",
          });
          if (workspaceSyncRetryTimerRef.current === null) {
            workspaceSyncRetryTimerRef.current = window.setTimeout(() => {
              workspaceSyncRetryTimerRef.current = null;
              setWorkspaceSyncRetry((value) => value + 1);
            }, WORKSPACE_SYNC_RETRY_TIMEOUT);
          }
        })
        .finally(() => {
          workspaceSyncInFlightRef.current = null;
        });
      workspaceSyncInFlightRef.current = operation;
      return operation;
    },
    [
      collabAPI,
      applyWorkspaceDocument,
      commitWorkspaceIndex,
      drawsyAuth.user,
      excalidrawAPI,
      saveWorkspaceCanvas,
      workspaceSync,
    ],
  );

  useEffect(() => {
    if (
      !workspaceSync ||
      !workspaceIndex ||
      !drawsyAuth.user ||
      workspaceScopeRef.current !== drawsyAuth.user.uid ||
      collabAPI?.isCollaborating()
    ) {
      return;
    }
    const hasPendingWork =
      workspaceIndex.pendingDeletes.length > 0 ||
      workspaceIndex.projects.some((project) => project.sync.dirty) ||
      workspaceIndex.canvases.some((canvas) => canvas.sync.dirty);
    if (!hasPendingWork) {
      setWorkspaceSyncStatus("synced");
      return;
    }

    if (workspaceSyncTimerRef.current !== null) {
      window.clearTimeout(workspaceSyncTimerRef.current);
    }
    setWorkspaceSyncStatus("pending");
    workspaceSyncTimerRef.current = window.setTimeout(() => {
      workspaceSyncTimerRef.current = null;
      void syncWorkspaceNow();
    }, WORKSPACE_SYNC_IDLE_TIMEOUT);

    return () => {
      if (workspaceSyncTimerRef.current !== null) {
        window.clearTimeout(workspaceSyncTimerRef.current);
        workspaceSyncTimerRef.current = null;
      }
    };
  }, [
    collabAPI,
    drawsyAuth.user,
    syncWorkspaceNow,
    workspaceIndex,
    workspaceSyncRetry,
    workspaceSync,
  ]);

  useEffect(() => {
    const retryWorkspaceSync = () => void syncWorkspaceNow();
    window.addEventListener("online", retryWorkspaceSync);
    return () => window.removeEventListener("online", retryWorkspaceSync);
  }, [syncWorkspaceNow]);

  useEffect(() => {
    const flushWorkspace = () => {
      if (document.visibilityState === "hidden") {
        void syncWorkspaceNow(true);
      }
    };
    const flushWorkspaceOnPageHide = () => void syncWorkspaceNow(true);
    document.addEventListener(EVENT.VISIBILITY_CHANGE, flushWorkspace);
    window.addEventListener("pagehide", flushWorkspaceOnPageHide);
    return () => {
      document.removeEventListener(EVENT.VISIBILITY_CHANGE, flushWorkspace);
      window.removeEventListener("pagehide", flushWorkspaceOnPageHide);
    };
  }, [syncWorkspaceNow]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") {
      return;
    }
    const channel = new BroadcastChannel(WORKSPACE_SYNC_CHANNEL);
    channel.onmessage = (event: MessageEvent) => {
      const message = event.data as { source?: string; scope?: string };
      if (
        message.source !== WORKSPACE_CLIENT_ID &&
        message.scope === WorkspaceStore.getScope()
      ) {
        void queueWorkspaceOperation(async () => {
          const currentIndex = workspaceIndexRef.current;
          const latestIndex = await WorkspaceStore.getIndex();
          if (!currentIndex || !latestIndex || !excalidrawAPI) {
            return;
          }

          const activeCanvasId = currentIndex.activeCanvasId;
          const currentFingerprint = getWorkspaceSceneFingerprint(
            excalidrawAPI.getSceneElementsIncludingDeleted(),
            excalidrawAPI.getAppState(),
            excalidrawAPI.getFiles(),
          );
          if (
            workspaceSceneFingerprintsRef.current.get(activeCanvasId) !==
            currentFingerprint
          ) {
            return;
          }

          const latestActive = latestIndex.canvases.find(
            (canvas) => canvas.id === activeCanvasId,
          );
          const nextActiveCanvasId = latestActive
            ? activeCanvasId
            : latestIndex.activeCanvasId;
          const nextIndex = {
            ...latestIndex,
            activeCanvasId: nextActiveCanvasId,
          };
          const previousActive = currentIndex.canvases.find(
            (canvas) => canvas.id === activeCanvasId,
          );
          const nextActive = nextIndex.canvases.find(
            (canvas) => canvas.id === nextActiveCanvasId,
          );
          commitWorkspaceIndex(nextIndex);
          if (
            nextActive &&
            (nextActive.id !== previousActive?.id ||
              nextActive.version > previousActive.version)
          ) {
            const document = await WorkspaceStore.getDocument(nextActive.id);
            if (document) {
              applyWorkspaceDocument(document);
            }
          }
          setWorkspaceSyncRetry((value) => value + 1);
        }).catch((error) => {
          console.error("Failed to refresh workspace from another tab", error);
        });
      }
    };
    return () => channel.close();
  }, [
    applyWorkspaceDocument,
    commitWorkspaceIndex,
    excalidrawAPI,
    queueWorkspaceOperation,
  ]);

  useEffect(() => {
    if (drawsyAuth.error) {
      setErrorMessage(drawsyAuth.error);
    }
  }, [drawsyAuth.error]);

  const createWorkspaceCanvas = useCallback(() => {
    void runWorkspaceSwitch((index) =>
      WorkspaceStore.createCanvas(index, createBlankScene()),
    ).then((result) => {
      if (result) {
        setPresentationCanvasActive(false);
      }
    });
  }, [createBlankScene, runWorkspaceSwitch, setPresentationCanvasActive]);

  const createWorkspaceProject = useCallback(() => {
    void runWorkspaceSwitch((index) =>
      WorkspaceStore.createProject(index, createBlankScene()),
    ).then((result) => {
      if (result) {
        setPresentationCanvasActive(false);
      }
      if (result?.document?.projectId) {
        setProjectTitleToFocus(result.document.projectId);
      }
    });
  }, [createBlankScene, runWorkspaceSwitch, setPresentationCanvasActive]);

  const createWorkspaceProjectCanvas = useCallback(
    (projectId: string) => {
      void runWorkspaceSwitch((index) =>
        WorkspaceStore.createCanvas(index, createBlankScene(), projectId),
      ).then((result) => {
        if (result) {
          setPresentationCanvasActive(false);
        }
      });
    },
    [createBlankScene, runWorkspaceSwitch, setPresentationCanvasActive],
  );

  const openWorkspaceCanvas = useCallback(
    (canvasId: string) => {
      if (workspaceSwitchingRef.current) {
        excalidrawAPI?.updateScene({ appState: { openMenu: null } });
        return;
      }
      if (canvasId === workspaceIndexRef.current?.activeCanvasId) {
        if (!presentationCanvasOpenRef.current) {
          excalidrawAPI?.updateScene({ appState: { openMenu: null } });
          return;
        }
      }
      workspaceSwitchingRef.current = true;
      setLoadingCanvasId(canvasId);
      excalidrawAPI?.updateScene({ appState: { isLoading: true } });
      void runWorkspaceSwitch((index) =>
        workspaceSync
          ? workspaceSync.openCanvas(index, canvasId)
          : WorkspaceStore.openCanvas(index, canvasId),
      )
        .then((result) => {
          if (result) {
            setPresentationCanvasActive(false);
          }
          if (result?.usedCachedScene) {
            excalidrawAPI?.setToast({
              message:
                "Opened the saved offline copy. Drawsy will check for updates when you're online.",
            });
          }
        })
        .finally(() => {
          workspaceSwitchingRef.current = false;
          setLoadingCanvasId(null);
          excalidrawAPI?.updateScene({ appState: { isLoading: false } });
        });
    },
    [
      excalidrawAPI,
      runWorkspaceSwitch,
      setPresentationCanvasActive,
      workspaceSync,
    ],
  );

  const openKanbanCanvasLink = useCallback(
    (canvasId: string) => {
      setKanbanWorkspaceActive(false);
      openWorkspaceCanvas(canvasId);
    },
    [openWorkspaceCanvas, setKanbanWorkspaceActive],
  );

  const deleteWorkspaceCanvas = useCallback(
    async (canvasId: string) =>
      !!(await runWorkspaceSwitch((index) =>
        WorkspaceStore.deleteCanvas(index, canvasId, createBlankScene()),
      )),
    [createBlankScene, runWorkspaceSwitch],
  );

  const deleteWorkspaceProject = useCallback(
    async (projectId: string) =>
      !!(await runWorkspaceSwitch((index) =>
        WorkspaceStore.deleteProject(index, projectId, createBlankScene()),
      )),
    [createBlankScene, runWorkspaceSwitch],
  );

  const [latestShareableLink, setLatestShareableLink] = useState<string | null>(
    null,
  );

  const onExportToBackend = async (
    exportedElements: readonly NonDeletedExcalidrawElement[],
    appState: Partial<AppState>,
    files: BinaryFiles,
  ) => {
    if (exportedElements.length === 0) {
      throw new Error(t("alerts.cannotExportEmptyCanvas"));
    }
    try {
      const { url, errorMessage } = await exportToBackend(
        exportedElements,
        {
          ...appState,
          viewBackgroundColor: appState.exportBackground
            ? appState.viewBackgroundColor
            : getDefaultAppState().viewBackgroundColor,
        },
        files,
      );

      if (errorMessage) {
        throw new Error(errorMessage);
      }

      if (url) {
        setLatestShareableLink(url);
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        const { width, height } = appState;
        console.error(error, {
          width,
          height,
          devicePixelRatio: window.devicePixelRatio,
        });
        throw new Error(error.message);
      }
    }
  };

  const renderCustomStats = (
    elements: readonly NonDeletedExcalidrawElement[],
    appState: UIAppState,
  ) => {
    return (
      <CustomStats
        setToast={(message) => excalidrawAPI!.setToast({ message })}
        appState={appState}
        elements={elements}
      />
    );
  };

  const isOffline = useAtomValue(isOfflineAtom);

  const activeCanvas = workspaceIndex?.canvases.find(
    (canvas) => canvas.id === workspaceIndex.activeCanvasId,
  );
  const activeProject = workspaceIndex?.projects.find(
    (project) => project.id === activeCanvas?.projectId,
  );
  const comments = useCanvasComments({
    auth: drawsyAuth,
    canvasId: presentationCanvasOpen ? null : activeCanvas?.id || null,
    enabled: !!activeCanvas && !isCollaborating && !presentationCanvasOpen,
    sidebarOpen: commentsSidebarOpen,
  });
  const {
    placing: isPlacingComment,
    selectAnchor: selectCommentAnchor,
    setDraftAnchor: setCommentDraftAnchor,
    setPlacing: setCommentPlacement,
    setSelectedId: setSelectedCommentId,
  } = comments;

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }
    if (!isPlacingComment) {
      return;
    }
    excalidrawAPI.setActiveTool({ type: "custom", customType: "comment" });
    excalidrawAPI.setCursor("none");
    const unsubscribe = excalidrawAPI.onPointerDown(
      (_activeTool, pointerDownState) => {
        selectCommentAnchor({
          x: pointerDownState.origin.x,
          y: pointerDownState.origin.y,
          elementId: null,
        });
        excalidrawAPI.setActiveTool({ type: "selection" });
      },
    );
    return () => {
      unsubscribe();
      const activeTool = excalidrawAPI.getAppState().activeTool;
      if (activeTool.type === "custom" && activeTool.customType === "comment") {
        excalidrawAPI.setActiveTool({ type: "selection" });
      }
      excalidrawAPI.resetCursor();
    };
  }, [excalidrawAPI, isPlacingComment, selectCommentAnchor]);

  const goToComment = useCallback(
    (comment: CanvasComment) => {
      if (!excalidrawAPI) {
        return;
      }
      const appState = excalidrawAPI.getAppState();
      excalidrawAPI.updateScene({
        appState: {
          scrollX: appState.width / 2 / appState.zoom.value - comment.x,
          scrollY: appState.height / 2 / appState.zoom.value - comment.y,
          openSidebar: { name: DEFAULT_SIDEBAR.name, tab: "comments" },
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    },
    [excalidrawAPI],
  );

  const selectComment = useCallback(
    (comment: CanvasComment) => {
      setSelectedCommentId(comment.id);
      goToComment(comment);
    },
    [goToComment, setSelectedCommentId],
  );

  const beginCommentPlacement = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }
    if (
      drawsyAuth.status !== "authenticated" ||
      isCollaborating ||
      !activeCanvas
    ) {
      excalidrawAPI.updateScene({
        appState: {
          openSidebar: { name: DEFAULT_SIDEBAR.name, tab: "comments" },
        },
      });
      return;
    }
    setSelectedCommentId(null);
    setCommentDraftAnchor(null);
    setCommentPlacement(!isPlacingComment);
    excalidrawAPI.updateScene({ appState: { openSidebar: null } });
  }, [
    drawsyAuth.status,
    excalidrawAPI,
    activeCanvas,
    isPlacingComment,
    isCollaborating,
    setCommentDraftAnchor,
    setCommentPlacement,
    setSelectedCommentId,
  ]);

  const renameActiveCanvas = useCallback(
    (title: string) => {
      if (!excalidrawAPI || !activeCanvas) {
        return;
      }
      const index = workspaceIndexRef.current;
      if (!index) {
        return;
      }
      const normalizedTitle = title.trim() || "Untitled";
      commitWorkspaceIndex({
        ...index,
        canvases: index.canvases.map((canvas) =>
          canvas.id === activeCanvas.id
            ? { ...canvas, title: normalizedTitle }
            : canvas,
        ),
      });
      excalidrawAPI.updateScene({
        appState: { name: normalizedTitle },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    },
    [activeCanvas, commitWorkspaceIndex, excalidrawAPI],
  );

  const renameActiveProject = useCallback(
    (title: string) => {
      if (!activeProject) {
        return;
      }
      void queueWorkspaceOperation(async () => {
        const index = workspaceIndexRef.current;
        if (index) {
          commitWorkspaceIndex(
            await WorkspaceStore.renameProject(index, activeProject.id, title),
          );
        }
      });
    },
    [activeProject, commitWorkspaceIndex, queueWorkspaceOperation],
  );

  const clearProjectTitleFocus = useCallback(
    () => setProjectTitleToFocus(null),
    [],
  );

  const localStorageQuotaExceeded = useAtomValue(localStorageQuotaExceededAtom);

  const onCollabDialogOpen = useCallback(
    () => setShareDialogState({ isOpen: true, type: "collaborationOnly" }),
    [setShareDialogState],
  );

  // ---------------------------------------------------------------------------
  // onExport — intercepts file save to wait for pending image loads
  // ---------------------------------------------------------------------------
  const onExport: Required<ExcalidrawProps>["onExport"] = useCallback(
    async function* () {
      let snapshot = FileStatusStore.getSnapshot();
      const { pending, total } = FileStatusStore.getPendingCount(
        snapshot.value,
      );
      if (pending === 0) {
        return;
      }

      // Yield initial progress
      yield {
        type: "progress",
        progress: (total - pending) / total,
        message: `Loading images (${total - pending}/${total})...`,
      };

      // Wait for all pending images to finish
      while (true) {
        snapshot = await FileStatusStore.pull(snapshot.version);
        const { pending: nowPending, total: nowTotal } =
          FileStatusStore.getPendingCount(snapshot.value);

        yield {
          type: "progress",
          progress: (nowTotal - nowPending) / nowTotal,
          message: `Loading images (${nowTotal - nowPending}/${nowTotal})...`,
        };

        if (nowPending === 0) {
          await new Promise((r) => setTimeout(r, 500));
          yield {
            type: "progress",
            message: `Preparing export...`,
          };
          return;
        }
      }
    },
    [],
  );

  // const onExport = () => {
  //   return new Promise((r) => setTimeout(r, 2500));
  //   // console.log("onExport");
  // };

  // browsers generally prevent infinite self-embedding, there are
  // cases where it still happens, and while we disallow self-embedding
  // by not whitelisting our own origin, this serves as an additional guard
  if (isSelfEmbedding) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          height: "100%",
        }}
      >
        <h1>I'm not a pretzel!</h1>
      </div>
    );
  }

  const ExcalidrawPlusCommand = {
    label: "Excalidraw+",
    category: DEFAULT_CATEGORIES.links,
    predicate: true,
    icon: <div style={{ width: 14 }}>{ExcalLogo}</div>,
    keywords: ["plus", "cloud", "server"],
    perform: () => {
      window.open(
        `${
          import.meta.env.VITE_APP_PLUS_LP
        }/plus?utm_source=excalidraw&utm_medium=app&utm_content=command_palette`,
        "_blank",
      );
    },
  };
  const ExcalidrawPlusAppCommand = {
    label: "Sign up",
    category: DEFAULT_CATEGORIES.links,
    predicate: true,
    icon: <div style={{ width: 14 }}>{ExcalLogo}</div>,
    keywords: [
      "excalidraw",
      "plus",
      "cloud",
      "server",
      "signin",
      "login",
      "signup",
    ],
    perform: () => {
      window.open(
        `${
          import.meta.env.VITE_APP_PLUS_APP
        }?utm_source=excalidraw&utm_medium=app&utm_content=command_palette`,
        "_blank",
      );
    },
  };

  return (
    <div
      style={{ height: "100%" }}
      className={clsx("excalidraw-app", {
        "is-collaborating": isCollaborating,
        "is-kanban-open": kanbanOpen,
      })}
    >
      <Excalidraw
        onChange={onChange}
        onExport={onExport}
        initialData={initialStatePromiseRef.current.promise}
        isCollaborating={isCollaborating}
        onPointerUpdate={collabAPI?.onPointerUpdate}
        UIOptions={{
          canvasActions: {
            toggleTheme: true,
            export: {
              onExportToBackend,
              renderCustomUI: excalidrawAPI
                ? (elements, appState, files) => {
                    return (
                      <ExportToExcalidrawPlus
                        elements={elements}
                        appState={appState}
                        files={files}
                        name={excalidrawAPI.getName()}
                        onError={(error) => {
                          excalidrawAPI?.updateScene({
                            appState: {
                              errorMessage: error.message,
                            },
                          });
                        }}
                        onSuccess={() => {
                          excalidrawAPI.updateScene({
                            appState: { openDialog: null },
                          });
                        }}
                      />
                    );
                  }
                : undefined,
            },
          },
        }}
        langCode={langCode}
        renderCustomStats={renderCustomStats}
        detectScroll={false}
        handleKeyboardGlobally={true}
        autoFocus={true}
        theme={editorTheme}
        onThemeChange={setAppTheme}
        renderTopRightUI={(isMobile) => {
          if (isMobile || (!kanbanOpen && (!collabAPI || isCollabDisabled))) {
            return null;
          }

          return (
            <div className="excalidraw-ui-top-right">
              {collabError.message && <CollabError collabError={collabError} />}
              {excalidrawAPI?.getEditorInterface().formFactor === "desktop" && (
                <TopRightToolbar
                  onShareSelect={() =>
                    setShareDialogState({ isOpen: true, type: "share" })
                  }
                  onCommentSelect={beginCommentPlacement}
                  isPlacingComment={isPlacingComment}
                  isKanbanOpen={kanbanOpen}
                  onCollabDialogOpen={() => {
                    if (!kanbanOpen) {
                      onCollabDialogOpen();
                      return;
                    }
                    if (!drawsyAuth.user) {
                      void drawsyAuth.signIn().catch(() => undefined);
                      return;
                    }
                    if (kanbanRole !== "owner") {
                      setErrorMessage(
                        "Only the board owner can invite members.",
                      );
                      return;
                    }
                    setKanbanShareOpen(true);
                  }}
                />
              )}
            </div>
          );
        }}
        onLinkOpen={(element, event) => {
          if (element.link && isElementLink(element.link)) {
            event.preventDefault();
            excalidrawAPI?.scrollToContent(element.link, { animate: true });
          }
        }}
      >
        <AppMainMenu
          onCollabDialogOpen={onCollabDialogOpen}
          isCollaborating={isCollaborating}
          isCollabEnabled={!isCollabDisabled}
          theme={appTheme}
          onThemeChange={setAppTheme}
          language={langCode}
          onLanguageChange={setLangCode}
          auth={{
            status: drawsyAuth.status,
            displayName:
              drawsyAuth.user?.displayName || drawsyAuth.user?.email || null,
            isBusy: drawsyAuth.isBusy,
            syncStatus: workspaceSyncStatus,
            onSync: () => void syncWorkspaceNow(true, true),
            onSignIn: () => {
              void drawsyAuth.signIn().catch(() => undefined);
            },
          }}
          addMenu={
            <WorkspaceMenu
              index={workspaceIndex}
              kanbanActive={kanbanOpen}
              disabled={!workspaceIndex || isCollaborating}
              onCreateCanvas={() => {
                setKanbanWorkspaceActive(false);
                createWorkspaceCanvas();
              }}
              onCreateProject={() => {
                setKanbanWorkspaceActive(false);
                createWorkspaceProject();
              }}
              onOpenKanban={() => {
                setCommentPlacement(false);
                setCommentDraftAnchor(null);
                setCommentsSidebarOpen(false);
                excalidrawAPI?.updateScene({
                  appState: { openSidebar: null, openMenu: null },
                });
                setKanbanWorkspaceActive(true);
              }}
              onOpenPresentation={() => {
                setCommentPlacement(false);
                setCommentDraftAnchor(null);
                setCommentsSidebarOpen(false);
                setKanbanWorkspaceActive(false);
                void openPresentationCanvas();
              }}
              onCreateProjectCanvas={(projectId) => {
                setKanbanWorkspaceActive(false);
                createWorkspaceProjectCanvas(projectId);
              }}
              onOpenCanvas={(canvasId) => {
                setKanbanWorkspaceActive(false);
                openWorkspaceCanvas(canvasId);
              }}
              onDeleteCanvas={deleteWorkspaceCanvas}
              onDeleteProject={deleteWorkspaceProject}
              loadingCanvasId={loadingCanvasId}
            />
          }
          header={
            kanbanOpen ? (
              <WorkspaceTitle
                canvasTitle={kanbanBoardReady ? kanbanBoard.title : "Kanban"}
                projectTitle={null}
                focusProjectTitle={false}
                itemLabel="Kanban"
                readOnly={!kanbanBoardReady || kanbanRole === "viewer"}
                onCanvasTitleChange={(title) =>
                  updateKanbanBoard({ ...kanbanBoard, title })
                }
                onProjectTitleChange={() => undefined}
                onProjectTitleFocused={() => undefined}
              />
            ) : presentationCanvasOpen ? (
              <WorkspaceTitle
                canvasTitle="Presentation"
                projectTitle={null}
                focusProjectTitle={false}
                itemLabel="Presentation"
                readOnly
                onCanvasTitleChange={() => undefined}
                onProjectTitleChange={() => undefined}
                onProjectTitleFocused={() => undefined}
              />
            ) : activeCanvas ? (
              <WorkspaceTitle
                canvasTitle={activeCanvas.title}
                projectTitle={activeProject?.title || null}
                focusProjectTitle={
                  !!activeProject && projectTitleToFocus === activeProject.id
                }
                onCanvasTitleChange={renameActiveCanvas}
                onProjectTitleChange={renameActiveProject}
                onProjectTitleFocused={clearProjectTitleFocus}
              />
            ) : null
          }
        />
        {kanbanOpen && kanbanBoardReady && (
          <KanbanWorkspace
            board={
              kanbanRole === "viewer"
                ? { ...kanbanBoard, isLocked: true }
                : kanbanBoard
            }
            onChange={updateKanbanBoard}
            readOnly={kanbanRole === "viewer"}
            syncStatus={kanbanSyncStatus}
            currentUserId={drawsyAuth.user?.uid || null}
            currentUserDisplayName={
              drawsyAuth.user?.displayName || drawsyAuth.user?.email || "You"
            }
            canvases={workspaceIndex?.canvases || []}
            onOpenCanvas={openKanbanCanvasLink}
          />
        )}
        <DefaultSidebar.Trigger style={{ display: "none" }} />
        {!kanbanOpen && (
          <AppWelcomeScreen
            onCollabDialogOpen={onCollabDialogOpen}
            isCollabEnabled={!isCollabDisabled}
          />
        )}
        <OverwriteConfirmDialog>
          <OverwriteConfirmDialog.Actions.ExportToImage />
          <OverwriteConfirmDialog.Actions.SaveToDisk />
          {excalidrawAPI && (
            <OverwriteConfirmDialog.Action
              title={t("overwriteConfirm.action.excalidrawPlus.title")}
              actionLabel={t("overwriteConfirm.action.excalidrawPlus.button")}
              onClick={() => {
                exportToExcalidrawPlus(
                  excalidrawAPI.getSceneElements(),
                  excalidrawAPI.getAppState(),
                  excalidrawAPI.getFiles(),
                  excalidrawAPI.getName(),
                );
              }}
            >
              {t("overwriteConfirm.action.excalidrawPlus.description")}
            </OverwriteConfirmDialog.Action>
          )}
        </OverwriteConfirmDialog>
        {excalidrawAPI && <AIComponents excalidrawAPI={excalidrawAPI} />}

        <TTDDialogTrigger />
        {isCollaborating && isOffline && (
          <div className="alertalert--warning">
            {t("alerts.collabOfflineWarning")}
          </div>
        )}
        {localStorageQuotaExceeded && (
          <div className="alert alert--danger">
            {t("alerts.localStorageQuotaExceeded")}
          </div>
        )}
        {latestShareableLink && (
          <ShareableLinkDialog
            link={latestShareableLink}
            onCloseRequest={() => setLatestShareableLink(null)}
            setErrorMessage={setErrorMessage}
          />
        )}
        {excalidrawAPI && !isCollabDisabled && (
          <Collab excalidrawAPI={excalidrawAPI} />
        )}

        <ShareDialog
          collabAPI={collabAPI}
          onExportToBackend={async () => {
            if (excalidrawAPI) {
              try {
                await onExportToBackend(
                  excalidrawAPI.getSceneElements(),
                  excalidrawAPI.getAppState(),
                  excalidrawAPI.getFiles(),
                );
              } catch (error: any) {
                setErrorMessage(error.message);
              }
            }
          }}
        />

        {kanbanApi && kanbanInvitationToken && (
          <KanbanShareDialog
            mode="accept"
            api={kanbanApi}
            token={kanbanInvitationToken}
            onAccepted={openAcceptedKanbanBoard}
            onClose={clearKanbanInvitation}
          />
        )}
        {kanbanApi && kanbanShareOpen && !kanbanInvitationToken && (
          <KanbanShareDialog
            mode="invite"
            api={kanbanApi}
            boardId={kanbanBoard.id}
            onClose={() => setKanbanShareOpen(false)}
          />
        )}

        <AppSidebar
          authStatus={drawsyAuth.status}
          displayName={
            drawsyAuth.user?.displayName || drawsyAuth.user?.email || "You"
          }
          canvasTitle={
            kanbanOpen
              ? kanbanBoardReady
                ? kanbanBoard.title
                : "Kanban"
              : presentationCanvasOpen
              ? "Presentation"
              : activeCanvas?.title || "Canvas"
          }
          isCollaborating={isCollaborating}
          comments={comments}
          onSignIn={() => void drawsyAuth.signIn().catch(() => undefined)}
          onStartPlacement={
            presentationCanvasOpen || kanbanOpen
              ? () => undefined
              : beginCommentPlacement
          }
          onGoToComment={goToComment}
          onCommentsOpenChange={setCommentsSidebarOpen}
        />
        {drawsyAuth.status === "authenticated" &&
          !isCollaborating &&
          !kanbanOpen &&
          !presentationCanvasOpen && (
            <CommentPins
              comments={comments.comments}
              selectedId={comments.selectedId}
              onSelect={selectComment}
            />
          )}
        {drawsyAuth.status === "authenticated" &&
          !isCollaborating &&
          !kanbanOpen &&
          !presentationCanvasOpen &&
          (comments.placing || comments.draftAnchor) && (
            <CommentDraftBubble
              anchor={comments.draftAnchor}
              placing={comments.placing}
              number={comments.comments.length + 1}
              initialBody={comments.draftBody}
              onCancel={() => comments.setDraftAnchor(null)}
              onSave={comments.create}
            />
          )}

        {errorMessage && (
          <ErrorDialog onClose={() => setErrorMessage("")}>
            {errorMessage}
          </ErrorDialog>
        )}

        <CommandPalette
          customCommandPaletteItems={[
            {
              label: t("labels.liveCollaboration"),
              category: DEFAULT_CATEGORIES.app,
              keywords: [
                "team",
                "multiplayer",
                "share",
                "public",
                "session",
                "invite",
              ],
              icon: usersIcon,
              perform: () => {
                setShareDialogState({
                  isOpen: true,
                  type: "collaborationOnly",
                });
              },
            },
            {
              label: t("roomDialog.button_stopSession"),
              category: DEFAULT_CATEGORIES.app,
              predicate: () => !!collabAPI?.isCollaborating(),
              keywords: [
                "stop",
                "session",
                "end",
                "leave",
                "close",
                "exit",
                "collaboration",
              ],
              perform: () => {
                if (collabAPI) {
                  collabAPI.stopCollaboration();
                  if (!collabAPI.isCollaborating()) {
                    setShareDialogState({ isOpen: false });
                  }
                }
              },
            },
            {
              label: t("labels.share"),
              category: DEFAULT_CATEGORIES.app,
              predicate: true,
              icon: share,
              keywords: [
                "link",
                "shareable",
                "readonly",
                "export",
                "publish",
                "snapshot",
                "url",
                "collaborate",
                "invite",
              ],
              perform: async () => {
                setShareDialogState({ isOpen: true, type: "share" });
              },
            },
            {
              label: "GitHub",
              icon: GithubIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: [
                "issues",
                "bugs",
                "requests",
                "report",
                "features",
                "social",
                "community",
              ],
              perform: () => {
                window.open(
                  "https://github.com/excalidraw/excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: t("labels.followUs"),
              icon: XBrandIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: ["twitter", "contact", "social", "community"],
              perform: () => {
                window.open(
                  "https://x.com/excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: t("labels.discordChat"),
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              icon: DiscordIcon,
              keywords: [
                "chat",
                "talk",
                "contact",
                "bugs",
                "requests",
                "report",
                "feedback",
                "suggestions",
                "social",
                "community",
              ],
              perform: () => {
                window.open(
                  "https://discord.gg/UexuTaE",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: "YouTube",
              icon: youtubeIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: ["features", "tutorials", "howto", "help", "community"],
              perform: () => {
                window.open(
                  "https://youtube.com/@excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            ...(isExcalidrawPlusSignedUser
              ? [
                  {
                    ...ExcalidrawPlusAppCommand,
                    label: "Sign in / Go to Excalidraw+",
                  },
                ]
              : [ExcalidrawPlusCommand, ExcalidrawPlusAppCommand]),

            {
              label: t("overwriteConfirm.action.excalidrawPlus.button"),
              category: DEFAULT_CATEGORIES.export,
              icon: exportToPlus,
              predicate: true,
              keywords: ["plus", "export", "save", "backup"],
              perform: () => {
                if (excalidrawAPI) {
                  exportToExcalidrawPlus(
                    excalidrawAPI.getSceneElements(),
                    excalidrawAPI.getAppState(),
                    excalidrawAPI.getFiles(),
                    excalidrawAPI.getName(),
                  );
                }
              },
            },
            {
              label: t("labels.installPWA"),
              category: DEFAULT_CATEGORIES.app,
              predicate: () => !!pwaEvent,
              perform: () => {
                if (pwaEvent) {
                  pwaEvent.prompt();
                  pwaEvent.userChoice.then(() => {
                    // event cannot be reused, but we'll hopefully
                    // grab new one as the event should be fired again
                    pwaEvent = null;
                  });
                }
              },
            },
          ]}
        />
        {isVisualDebuggerEnabled() && excalidrawAPI && (
          <DebugCanvas
            appState={excalidrawAPI.getAppState()}
            scale={window.devicePixelRatio}
            ref={debugCanvasRef}
          />
        )}
      </Excalidraw>
    </div>
  );
};

const ExcalidrawApp = () => {
  const isCloudExportWindow =
    window.location.pathname === "/excalidraw-plus-export";
  if (isCloudExportWindow) {
    return <ExcalidrawPlusIframeExport />;
  }

  return (
    <TopErrorBoundary>
      <Provider store={appJotaiStore}>
        <ExcalidrawAPIProvider>
          <ExcalidrawWrapper />
        </ExcalidrawAPIProvider>
      </Provider>
    </TopErrorBoundary>
  );
};

export default ExcalidrawApp;
