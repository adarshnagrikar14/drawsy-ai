import {
  DefaultSidebar,
  Excalidraw,
  TTDDialogTrigger,
  CaptureUpdateAction,
  exportToCanvas,
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
  THEME,
  FONT_FAMILY,
  randomId,
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
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
  ExportIcon,
  exportToPlus,
  frameToolIcon,
  LoadIcon,
  share,
  messageCircleIcon,
  presentationIcon,
  playerPlayIcon,
  youtubeIcon,
  ArrowRightIcon,
  CloseIcon,
  MoonIcon,
  SunIcon,
  laserPointerToolIcon,
} from "@excalidraw/excalidraw/components/icons";
import { Button } from "@excalidraw/excalidraw/components/Button";
import {
  getNonDeletedElements,
  getCommonBounds,
  isElementLink,
  isFrameLikeElement,
  isInvisiblySmallElement,
  newElement,
  newFrameElement,
  newLinearElement,
  newTextElement,
} from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";
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
  ExcalidrawFrameLikeElement,
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
import {
  PresentationStore,
  type PresentationDocument,
  type PresentationIndex,
  type PresentationScene,
} from "./data/PresentationStore";
import {
  arePresentationAnimationMetadataEqual,
  createPresentationAnimationMetadata,
  getHiddenPresentationBuildTargetIds,
  getPresentationBuildSequence,
  getPresentationBuilds,
  getPreviousPresentationBuildCount,
  getPresentationTargetFrameId,
  sanitizePresentationAnimationMetadata,
  type PresentationAnimationMetadata,
  type PresentationBuild,
  type PresentationSlideTransition,
} from "./presentation/animations";
import { importPptxPresentation } from "./presentation/pptxImport";

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
import {
  AppSidebar,
  type PresentationLayout,
  type PresentationResourceConfig,
  type PresentationTemplateId,
} from "./components/AppSidebar";
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
  onPresentationSelect,
  isPlacingComment,
  isKanbanOpen,
  isPresentationOpen,
  onCollabDialogOpen,
}: {
  onShareSelect: () => void;
  onCommentSelect: () => void;
  onPresentationSelect: () => void;
  isPlacingComment: boolean;
  isKanbanOpen: boolean;
  isPresentationOpen: boolean;
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

  if (isPresentationOpen) {
    return (
      <>
        <Button
          className="sidebar-trigger default-sidebar-trigger active presentation-sidebar-trigger"
          title="Presentation"
          aria-label="Presentation"
          onSelect={onPresentationSelect}
        >
          {presentationIcon}
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

const isSceneEmptyForPresentation = (
  elements: readonly ExcalidrawElement[] | null | undefined,
) =>
  getNonDeletedElements(elements || []).every((element) =>
    isInvisiblySmallElement(element),
  );

const createInitialPresentationScene = (): PresentationScene => ({
  elements: [],
  appState: {
    ...getDefaultAppState(),
    name: "Untitled presentation",
    isLoading: false,
    openMenu: null,
  },
  files: {},
  presentation: createPresentationAnimationMetadata(),
});

const getPresentationFrames = (elements: readonly ExcalidrawElement[]) => {
  return getNonDeletedElements(elements)
    .filter(isFrameLikeElement)
    .sort((a, b) => {
      const rowTolerance = Math.max(80, Math.min(a.height, b.height) * 0.2);
      if (Math.abs(a.y - b.y) > rowTolerance) {
        return a.y - b.y;
      }
      return a.x - b.x;
    }) as ExcalidrawFrameLikeElement[];
};

const PRESENTATION_BUILD_DURATION_MS = 320;
const PRESENTATION_SLIDE_FADE_DURATION_MS = 160;

type FramePresenterState = {
  frameIds: string[];
  index: number;
  completedBuildCount: number;
  previousView: Pick<
    AppState,
    | "scrollX"
    | "scrollY"
    | "zoom"
    | "openSidebar"
    | "openMenu"
    | "viewModeEnabled"
    | "activeTool"
    | "frameRendering"
  >;
};

const waitForPresentationDuration = (durationMs: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, durationMs));

const PRESENTATION_TEMPLATE_SIZE = {
  width: 960,
  height: 540,
};

type PresentationExportFormat = "pdf" | "pngZip" | "pptx" | "docx";

const textEncoder = new TextEncoder();

const encodeText = (value: string) => textEncoder.encode(value);

const concatBytes = (chunks: readonly Uint8Array[]) => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  return bytes;
};

const canvasToBlob = (canvas: HTMLCanvasElement, type = "image/png") =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Unable to export slide image."));
      }
    }, type);
  });

const blobToBytes = async (blob: Blob) =>
  new Uint8Array(await blob.arrayBuffer());

const canvasToRgbBytes = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to read slide image data.");
  }

  const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const rgb = new Uint8Array(canvas.width * canvas.height * 3);

  for (
    let rgbaIndex = 0, rgbIndex = 0;
    rgbaIndex < rgba.length;
    rgbaIndex += 4, rgbIndex += 3
  ) {
    const alpha = rgba[rgbaIndex + 3] / 255;
    rgb[rgbIndex] = Math.round(rgba[rgbaIndex] * alpha + 255 * (1 - alpha));
    rgb[rgbIndex + 1] = Math.round(
      rgba[rgbaIndex + 1] * alpha + 255 * (1 - alpha),
    );
    rgb[rgbIndex + 2] = Math.round(
      rgba[rgbaIndex + 2] * alpha + 255 * (1 - alpha),
    );
  }

  return rgb;
};

const savePresentationBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const crcTable = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index++) {
    let value = index;

    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
})();

const getCrc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const numberToBytes = (value: number, byteCount: number) => {
  const bytes = new Uint8Array(byteCount);

  for (let index = 0; index < byteCount; index++) {
    bytes[index] = (value >>> (index * 8)) & 0xff;
  }

  return bytes;
};

const createZipBlob = (
  files: readonly { name: string; data: Uint8Array | string }[],
) => {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime =
    (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate =
    ((now.getFullYear() - 1980) << 9) |
    ((now.getMonth() + 1) << 5) |
    now.getDate();

  for (const file of files) {
    const name = encodeText(file.name);
    const data =
      typeof file.data === "string" ? encodeText(file.data) : file.data;
    const crc = getCrc32(data);
    const localHeader = concatBytes([
      numberToBytes(0x04034b50, 4),
      numberToBytes(20, 2),
      numberToBytes(0, 2),
      numberToBytes(0, 2),
      numberToBytes(dosTime, 2),
      numberToBytes(dosDate, 2),
      numberToBytes(crc, 4),
      numberToBytes(data.length, 4),
      numberToBytes(data.length, 4),
      numberToBytes(name.length, 2),
      numberToBytes(0, 2),
      name,
    ]);

    localChunks.push(localHeader, data);
    centralChunks.push(
      concatBytes([
        numberToBytes(0x02014b50, 4),
        numberToBytes(20, 2),
        numberToBytes(20, 2),
        numberToBytes(0, 2),
        numberToBytes(0, 2),
        numberToBytes(dosTime, 2),
        numberToBytes(dosDate, 2),
        numberToBytes(crc, 4),
        numberToBytes(data.length, 4),
        numberToBytes(data.length, 4),
        numberToBytes(name.length, 2),
        numberToBytes(0, 2),
        numberToBytes(0, 2),
        numberToBytes(0, 2),
        numberToBytes(0, 2),
        numberToBytes(0, 4),
        numberToBytes(offset, 4),
        name,
      ]),
    );
    offset += localHeader.length + data.length;
  }

  const centralDirectory = concatBytes(centralChunks);
  const end = concatBytes([
    numberToBytes(0x06054b50, 4),
    numberToBytes(0, 2),
    numberToBytes(0, 2),
    numberToBytes(files.length, 2),
    numberToBytes(files.length, 2),
    numberToBytes(centralDirectory.length, 4),
    numberToBytes(offset, 4),
    numberToBytes(0, 2),
  ]);

  return new Blob([concatBytes([...localChunks, centralDirectory, end])]);
};

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const createPresentationPdf = (
  slides: readonly { width: number; height: number; rgb: Uint8Array }[],
) => {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let position = 0;
  const add = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === "string" ? encodeText(chunk) : chunk;
    chunks.push(bytes);
    position += bytes.length;
  };
  const pageWidth = 720;
  const imageObjectStart = 3 + slides.length;
  const contentObjectStart = imageObjectStart + slides.length;
  const objectCount = 2 + slides.length * 3;

  add("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");
  const object = (id: number, body: () => void) => {
    offsets[id] = position;
    add(`${id} 0 obj\n`);
    body();
    add("\nendobj\n");
  };

  object(1, () => add("<< /Type /Catalog /Pages 2 0 R >>"));
  object(2, () =>
    add(
      `<< /Type /Pages /Kids [${slides
        .map((_, index) => `${3 + index} 0 R`)
        .join(" ")}] /Count ${slides.length} >>`,
    ),
  );

  slides.forEach((slide, index) => {
    const pageHeight = pageWidth * (slide.height / slide.width);
    object(3 + index, () =>
      add(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(
          2,
        )} ${pageHeight.toFixed(2)}] /Resources << /XObject << /Im${
          index + 1
        } ${imageObjectStart + index} 0 R >> >> /Contents ${
          contentObjectStart + index
        } 0 R >>`,
      ),
    );
  });

  slides.forEach((slide, index) => {
    object(imageObjectStart + index, () => {
      add(
        `<< /Type /XObject /Subtype /Image /Width ${slide.width} /Height ${slide.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${slide.rgb.length} >>\nstream\n`,
      );
      add(slide.rgb);
      add("\nendstream");
    });
  });

  slides.forEach((slide, index) => {
    const pageHeight = pageWidth * (slide.height / slide.width);
    const content = `q\n${pageWidth.toFixed(2)} 0 0 ${pageHeight.toFixed(
      2,
    )} 0 0 cm\n/Im${index + 1} Do\nQ`;
    object(contentObjectStart + index, () =>
      add(
        `<< /Length ${
          encodeText(content).length
        } >>\nstream\n${content}\nendstream`,
      ),
    );
  });

  const xrefStart = position;
  add(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
  for (let index = 1; index <= objectCount; index++) {
    add(`${`${offsets[index]}`.padStart(10, "0")} 00000 n \n`);
  }
  add(
    `trailer\n<< /Size ${
      objectCount + 1
    } /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`,
  );

  return new Blob([concatBytes(chunks).buffer as ArrayBuffer], {
    type: "application/pdf",
  });
};

const presentationContentTypes = (
  slideCount: number,
) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
${Array.from(
  { length: slideCount },
  (_, index) =>
    `<Override PartName="/ppt/slides/slide${
      index + 1
    }.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
).join("")}
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const createPresentationPptx = (
  slides: readonly { title: string; png: Uint8Array }[],
) => {
  const slideWidth = 12192000;
  const slideHeight = 6858000;
  const files: { name: string; data: Uint8Array | string }[] = [
    {
      name: "[Content_Types].xml",
      data: presentationContentTypes(slides.length),
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    },
    {
      name: "docProps/core.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Drawsy presentation</dc:title></cp:coreProperties>`,
    },
    {
      name: "docProps/app.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Drawsy</Application></Properties>`,
    },
    {
      name: "ppt/presentation.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides
        .map(
          (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`,
        )
        .join(
          "",
        )}</p:sldIdLst><p:sldSz cx="${slideWidth}" cy="${slideHeight}" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
    },
    {
      name: "ppt/_rels/presentation.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slides
        .map(
          (_, index) =>
            `<Relationship Id="rId${
              index + 2
            }" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${
              index + 1
            }.xml"/>`,
        )
        .join("")}</Relationships>`,
    },
    {
      name: "ppt/slideMasters/slideMaster1.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`,
    },
    {
      name: "ppt/slideMasters/_rels/slideMaster1.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`,
    },
    {
      name: "ppt/slideLayouts/slideLayout1.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
    },
    {
      name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`,
    },
    {
      name: "ppt/theme/theme1.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Drawsy"><a:themeElements><a:clrScheme name="Drawsy"><a:dk1><a:srgbClr val="111113"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F2937"/></a:dk2><a:lt2><a:srgbClr val="F8F9FA"/></a:lt2><a:accent1><a:srgbClr val="A5A0FF"/></a:accent1><a:accent2><a:srgbClr val="4DABF7"/></a:accent2><a:accent3><a:srgbClr val="69DB7C"/></a:accent3><a:accent4><a:srgbClr val="FFD43B"/></a:accent4><a:accent5><a:srgbClr val="FF8787"/></a:accent5><a:accent6><a:srgbClr val="DA77F2"/></a:accent6><a:hlink><a:srgbClr val="4DABF7"/></a:hlink><a:folHlink><a:srgbClr val="B197FC"/></a:folHlink></a:clrScheme><a:fontScheme name="Drawsy"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Drawsy"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:lumMod val="110000"/><a:satMod val="105000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="90000"/><a:satMod val="105000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:lumMod val="102000"/><a:satMod val="103000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="94000"/><a:satMod val="110000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:tint val="95000"/><a:satMod val="170000"/></a:schemeClr></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="93000"/><a:satMod val="150000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="98000"/><a:satMod val="130000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`,
    },
  ];

  slides.forEach((slide, index) => {
    const slideNumber = index + 1;
    files.push(
      { name: `ppt/media/image${slideNumber}.png`, data: slide.png },
      {
        name: `ppt/slides/slide${slideNumber}.xml`,
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:pic><p:nvPicPr><p:cNvPr id="2" name="${xmlEscape(
          slide.title,
        )}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${slideWidth}" cy="${slideHeight}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
      },
      {
        name: `ppt/slides/_rels/slide${slideNumber}.xml.rels`,
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${slideNumber}.png"/></Relationships>`,
      },
    );
  });

  return createZipBlob(files);
};

const createPresentationDocx = (
  slides: readonly { title: string; png: Uint8Array }[],
) => {
  const imageWidth = 12192000;
  const imageHeight = 6858000;
  const body = slides
    .map((slide, index) => {
      const slideNumber = index + 1;
      const pageBreak =
        index === slides.length - 1
          ? ""
          : '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

      return `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${imageWidth}" cy="${imageHeight}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${slideNumber}" name="${xmlEscape(
        slide.title,
      )}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${slideNumber}" name="${xmlEscape(
        slide.title,
      )}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId${slideNumber}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${imageWidth}" cy="${imageHeight}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>${pageBreak}`;
    })
    .join("");
  const files: { name: string; data: Uint8Array | string }[] = [
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    },
    {
      name: "word/document.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="19200" w:h="10800" w:orient="landscape"/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`,
    },
    {
      name: "word/_rels/document.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${slides
        .map(
          (_, index) =>
            `<Relationship Id="rId${
              index + 1
            }" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${
              index + 1
            }.png"/>`,
        )
        .join("")}</Relationships>`,
    },
  ];

  slides.forEach((slide, index) => {
    files.push({ name: `word/media/image${index + 1}.png`, data: slide.png });
  });

  return createZipBlob(files);
};

const getPresentationTemplateOrigin = (
  frames: readonly ExcalidrawFrameLikeElement[],
  layout: PresentationLayout,
  appState: AppState,
) => {
  const gap = 160;

  if (frames.length) {
    const [minX, minY, maxX, maxY] = getCommonBounds(frames);

    if (layout === "horizontal" || layout === "grid") {
      return {
        x: maxX + gap,
        y: minY,
      };
    }

    if (layout === "vertical") {
      return {
        x: minX,
        y: maxY + gap,
      };
    }
  }

  const center = viewportCoordsToSceneCoords(
    {
      clientX: appState.offsetLeft + appState.width / 2,
      clientY: appState.offsetTop + appState.height / 2,
    },
    appState,
  );
  const freeformOffset = layout === "freeform" ? (frames.length % 5) * 56 : 0;

  return {
    x: center.x - PRESENTATION_TEMPLATE_SIZE.width / 2 + freeformOffset,
    y: center.y - PRESENTATION_TEMPLATE_SIZE.height / 2 + freeformOffset,
  };
};

const getArrangedPresentationElements = (
  elements: readonly ExcalidrawElement[],
  layout: PresentationLayout,
) => {
  if (layout === "freeform") {
    return null;
  }

  const frames = getPresentationFrames(elements);

  if (frames.length < 2) {
    return null;
  }

  const gap = 160;
  const originX = Math.min(...frames.map((frame) => frame.x));
  const originY = Math.min(...frames.map((frame) => frame.y));
  const maxWidth = Math.max(...frames.map((frame) => frame.width));
  const maxHeight = Math.max(...frames.map((frame) => frame.height));
  const columns =
    layout === "grid" ? Math.max(1, Math.ceil(Math.sqrt(frames.length))) : 1;
  const frameOffsets = new Map<string, { dx: number; dy: number }>();

  let cursorX = originX;
  let cursorY = originY;

  frames.forEach((frame, index) => {
    let nextX = frame.x;
    let nextY = frame.y;

    if (layout === "horizontal") {
      nextX = cursorX;
      nextY = originY;
      cursorX += frame.width + gap;
    } else if (layout === "vertical") {
      nextX = originX;
      nextY = cursorY;
      cursorY += frame.height + gap;
    } else if (layout === "grid") {
      nextX = originX + (index % columns) * (maxWidth + gap);
      nextY = originY + Math.floor(index / columns) * (maxHeight + gap);
    }

    frameOffsets.set(frame.id, {
      dx: nextX - frame.x,
      dy: nextY - frame.y,
    });
  });

  return elements.map((element) => {
    const offset = isFrameLikeElement(element)
      ? frameOffsets.get(element.id)
      : element.frameId
      ? frameOffsets.get(element.frameId)
      : null;

    if (!offset || (!offset.dx && !offset.dy)) {
      return element;
    }

    return newElementWith(element, {
      x: element.x + offset.dx,
      y: element.y + offset.dy,
    });
  });
};

const createPresentationTemplateElements = (
  templateId: PresentationTemplateId,
  origin: { x: number; y: number },
) => {
  const { width, height } = PRESENTATION_TEMPLATE_SIZE;
  const frame = newFrameElement({
    x: origin.x,
    y: origin.y,
    width,
    height,
    name: "Slide",
    strokeColor: "#868e96",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    roughness: 0,
  });
  const x = (value: number) => origin.x + value;
  const y = (value: number) => origin.y + value;
  const frameId = frame.id;
  const rect = (
    x1: number,
    y1: number,
    w: number,
    h: number,
    backgroundColor: string,
    strokeColor = "transparent",
    roughness = 0,
    opacity = 100,
  ) =>
    newElement({
      type: "rectangle",
      x: x(x1),
      y: y(y1),
      width: w,
      height: h,
      strokeColor,
      backgroundColor,
      fillStyle: "solid",
      strokeWidth: 2,
      roughness,
      opacity,
      frameId,
    });
  const ellipse = (
    x1: number,
    y1: number,
    w: number,
    h: number,
    backgroundColor: string,
    strokeColor = "transparent",
    roughness = 0,
    opacity = 100,
  ) =>
    newElement({
      type: "ellipse",
      x: x(x1),
      y: y(y1),
      width: w,
      height: h,
      strokeColor,
      backgroundColor,
      fillStyle: "solid",
      strokeWidth: 2,
      roughness,
      opacity,
      frameId,
    });
  const text = (
    value: string,
    x1: number,
    y1: number,
    fontSize: number,
    strokeColor: string,
    fontFamily = FONT_FAMILY["Comic Shanns"],
  ) =>
    newTextElement({
      text: value,
      x: x(x1),
      y: y(y1),
      fontSize,
      fontFamily,
      strokeColor,
      backgroundColor: "transparent",
      frameId,
    });

  const title = (value: string, subtitle: string, color = "#ffffff") => [
    text(value, 86, 204, 54, color),
    text(subtitle, 92, 292, 22, color, FONT_FAMILY.Excalifont),
  ];

  const templates: Record<PresentationTemplateId, ExcalidrawElement[]> = {
    "intro-orbit": [
      frame,
      rect(0, 0, width, height, "#161620"),
      ellipse(560, -105, 330, 330, "transparent", "#b197fc", 2),
      ellipse(614, -50, 220, 220, "transparent", "#4dabf7", 1.5),
      rect(72, 78, 166, 18, "#b197fc"),
      rect(72, 108, 92, 18, "#4dabf7"),
      ...title("Launch the idea", "A clean opening for the story ahead."),
      ellipse(728, 332, 118, 118, "#b197fc", "transparent", 0, 68),
    ],
    "intro-blocks": [
      frame,
      rect(0, 0, 350, 265, "#4dabf7"),
      rect(0, 275, 350, 265, "#da77f2"),
      rect(360, 0, 600, 540, "#ff8787"),
      ellipse(208, 205, 132, 132, "#f8f9fa"),
      text("WELCOME TO DRAWSY", 440, 224, 42, "#101113"),
      text(
        "Build the canvas into a guided presentation.",
        394,
        454,
        21,
        "#101113",
      ),
    ],
    "intro-claim": [
      frame,
      rect(0, 0, width, height, "#f8f9fa"),
      rect(58, 58, 844, 424, "#ffffff", "#212529", 2),
      rect(86, 86, 170, 20, "#ffd43b"),
      text("One canvas.", 108, 178, 56, "#212529"),
      text("Many moments.", 108, 250, 56, "#212529"),
      rect(598, 172, 220, 168, "#4dabf7", "#212529", 1.2),
      ellipse(682, 226, 70, 70, "#ff8787", "#212529", 1.2),
    ],
    "intro-signal": [
      frame,
      rect(0, 0, width, height, "#0b1110"),
      rect(86, 388, 760, 4, "#69db7c"),
      rect(132, 344, 170, 4, "#69db7c"),
      rect(358, 294, 198, 4, "#4dabf7"),
      rect(622, 222, 178, 4, "#ffd43b"),
      ellipse(110, 326, 76, 76, "#69db7c", "#0b1110", 0, 88),
      ellipse(348, 264, 92, 92, "#4dabf7", "#0b1110", 0, 78),
      ellipse(632, 174, 124, 124, "#ffd43b", "#0b1110", 0, 82),
      text("Follow the signal", 86, 108, 56, "#f8f9fa"),
      text("Set direction before details take over.", 92, 198, 23, "#ced4da"),
      rect(92, 248, 196, 12, "#69db7c"),
    ],
    "outro-closing": [
      frame,
      rect(0, 0, width, height, "#111827"),
      rect(70, 68, 820, 404, "#1f2030", "#91a7ff", 1.4, 82),
      rect(112, 112, 186, 16, "#91a7ff"),
      rect(112, 144, 118, 12, "#ff8787"),
      text("Thank you", 116, 206, 68, "#f8f9fa"),
      text("Keep the next move visible.", 122, 316, 25, "#d0bfff"),
      rect(650, 128, 150, 150, "transparent", "#bac8ff", 1.2),
      ellipse(704, 182, 42, 42, "#91a7ff"),
      rect(642, 340, 198, 12, "#ff8787"),
      rect(704, 370, 136, 10, "#bac8ff"),
    ],
    "outro-next": [
      frame,
      rect(0, 0, width, height, "#f1f3f5"),
      text("Next steps", 76, 72, 52, "#212529"),
      ...[0, 1, 2].flatMap((index) => [
        ellipse(96, 176 + index * 94, 36, 36, "#69db7c", "#212529", 1.2),
        rect(160, 184 + index * 94, 570 - index * 76, 18, "#212529"),
        rect(160, 214 + index * 94, 410 - index * 46, 10, "#868e96"),
      ]),
      rect(726, 78, 130, 330, "#b197fc", "#212529", 1.2, 72),
    ],
    "outro-qa": [
      frame,
      rect(0, 0, width, height, "#1e1e1e"),
      ellipse(96, 88, 250, 250, "#b197fc", "transparent", 0, 70),
      ellipse(560, 196, 270, 270, "#4dabf7", "transparent", 0, 52),
      text("Questions?", 292, 204, 70, "#ffffff"),
      text("Open discussion", 374, 318, 26, "#ced4da"),
    ],
    "outro-contact": [
      frame,
      rect(0, 0, width, height, "#fff4e6"),
      rect(90, 88, 780, 360, "#ffffff", "#212529", 1.5),
      rect(120, 122, 238, 250, "#ff8787", "#212529", 1.2),
      text("Stay connected", 420, 148, 46, "#212529"),
      text("name@drawsy.ai", 424, 246, 24, "#495057"),
      text("drawsy.ai", 424, 294, 24, "#495057"),
      ellipse(186, 178, 106, 106, "#fff4e6", "#212529", 1.2),
    ],
    "content-beats": [
      frame,
      rect(0, 0, width, height, "#101113"),
      text("Three beats", 72, 58, 46, "#ffffff"),
      ...[0, 1, 2].flatMap((index) => [
        rect(72 + index * 292, 158, 238, 260, "#25262b", "#868e96", 1.4),
        rect(
          102 + index * 292,
          198,
          98,
          18,
          ["#4dabf7", "#69db7c", "#ff8787"][index],
        ),
        text(`0${index + 1}`, 102 + index * 292, 252, 44, "#f8f9fa"),
        rect(102 + index * 292, 334, 150, 12, "#868e96"),
      ]),
    ],
    "content-data": [
      frame,
      rect(0, 0, width, height, "#f8f9fa"),
      text("Data story", 76, 62, 46, "#212529"),
      rect(94, 392, 720, 3, "#212529"),
      ...[0, 1, 2, 3, 4].map((index) =>
        rect(
          138 + index * 118,
          190 + index * 18,
          58,
          202 - index * 18,
          "#4dabf7",
          "#212529",
          0.8,
        ),
      ),
      text("+42%", 690, 114, 58, "#e03131"),
      text("momentum", 700, 184, 22, "#495057"),
    ],
    "content-flow": [
      frame,
      rect(0, 0, width, height, "#111827"),
      text("From idea to pitch", 72, 68, 44, "#f8f9fa"),
      ...[0, 1, 2, 3].flatMap((index) => [
        ellipse(
          106 + index * 196,
          238,
          108,
          108,
          ["#4dabf7", "#69db7c", "#ffd43b", "#ff8787"][index],
          "transparent",
          0,
          86,
        ),
        text(`${index + 1}`, 145 + index * 196, 270, 34, "#111827"),
        ...(index < 3 ? [rect(230 + index * 196, 290, 78, 10, "#ced4da")] : []),
      ]),
      text("Capture. Shape. Sequence. Present.", 178, 406, 25, "#ced4da"),
    ],
    "content-compare": [
      frame,
      rect(0, 0, width, height, "#f8f0fc"),
      rect(70, 90, 390, 350, "#ffffff", "#212529", 1.2),
      rect(500, 90, 390, 350, "#212529", "#212529", 1.2),
      text("Before", 118, 138, 40, "#212529"),
      text("After", 548, 138, 40, "#ffffff"),
      rect(118, 238, 246, 18, "#868e96"),
      rect(118, 286, 166, 18, "#adb5bd"),
      rect(548, 238, 246, 18, "#b197fc"),
      rect(548, 286, 292, 18, "#69db7c"),
    ],
  };

  return templates[templateId];
};

const parsePresentationResourceValue = (value: string, fallback: number) => {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
};

const createPresentationResourceElements = (
  config: PresentationResourceConfig,
  origin: { x: number; y: number },
  targetFrame?: ExcalidrawFrameLikeElement,
) => {
  const templateSize = PRESENTATION_TEMPLATE_SIZE;
  const frame =
    targetFrame ||
    newFrameElement({
      x: origin.x,
      y: origin.y,
      width: templateSize.width,
      height: templateSize.height,
      name: "Slide",
      strokeColor: "#868e96",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 2,
      roughness: 0,
    });
  const sx = frame.width / templateSize.width;
  const sy = frame.height / templateSize.height;
  const scale = Math.min(sx, sy);
  const frameId = frame.id;
  const rows = config.rows.length
    ? config.rows
    : [{ id: "fallback", label: "Item", value: "50" }];
  const values = rows.map((row, index) =>
    parsePresentationResourceValue(row.value, 20 + index * 12),
  );
  const maxValue = Math.max(1, ...values);
  const colors =
    config.style === "executive"
      ? ["#364fc7", "#495057", "#228be6", "#868e96", "#15aabf"]
      : config.style === "clean"
      ? ["#4dabf7", "#868e96", "#adb5bd", "#ced4da", "#495057"]
      : ["#4dabf7", "#69db7c", "#ff8787", "#ffd43b", "#b197fc"];
  const x = (value: number) => frame.x + value * sx;
  const y = (value: number) => frame.y + value * sy;
  const size = (value: number) => value * scale;
  const resourceElements: ExcalidrawElement[] = [];
  const add = (element: ExcalidrawElement) => {
    resourceElements.push(element);
  };
  const rect = (
    x1: number,
    y1: number,
    width: number,
    height: number,
    backgroundColor: string,
    strokeColor = "transparent",
    roughness = 0,
    opacity = 100,
  ) =>
    newElement({
      type: "rectangle",
      x: x(x1),
      y: y(y1),
      width: width * sx,
      height: height * sy,
      strokeColor,
      backgroundColor,
      fillStyle: "solid",
      strokeWidth: 2,
      roughness,
      opacity,
      frameId,
    });
  const ellipse = (
    x1: number,
    y1: number,
    width: number,
    height: number,
    backgroundColor: string,
    strokeColor = "transparent",
    roughness = 0,
    opacity = 100,
  ) =>
    newElement({
      type: "ellipse",
      x: x(x1),
      y: y(y1),
      width: width * sx,
      height: height * sy,
      strokeColor,
      backgroundColor,
      fillStyle: "solid",
      strokeWidth: 2,
      roughness,
      opacity,
      frameId,
    });
  const text = (
    value: string,
    x1: number,
    y1: number,
    fontSize: number,
    strokeColor: string,
    fontFamily = FONT_FAMILY["Comic Shanns"],
  ) =>
    newTextElement({
      text: value,
      x: x(x1),
      y: y(y1),
      fontSize: size(fontSize),
      fontFamily,
      strokeColor,
      backgroundColor: "transparent",
      frameId,
    });
  const line = (
    points: readonly [number, number][],
    strokeColor: string,
    strokeWidth = 3,
    strokeStyle: "solid" | "dashed" | "dotted" = "solid",
    opacity = 100,
  ) => {
    const scaledPoints = points.map(
      ([pointX, pointY]) => [pointX * sx, pointY * sy] as [number, number],
    );
    const minX = Math.min(...scaledPoints.map(([pointX]) => pointX));
    const minY = Math.min(...scaledPoints.map(([, pointY]) => pointY));
    const maxX = Math.max(...scaledPoints.map(([pointX]) => pointX));
    const maxY = Math.max(...scaledPoints.map(([, pointY]) => pointY));

    return newLinearElement({
      type: "line",
      x: frame.x + minX,
      y: frame.y + minY,
      width: maxX - minX,
      height: maxY - minY,
      points: scaledPoints.map(([pointX, pointY]) =>
        pointFrom(pointX - minX, pointY - minY),
      ),
      strokeColor,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth,
      strokeStyle,
      roughness: 1,
      opacity,
      frameId,
    });
  };

  if (!targetFrame) {
    add(frame);
  }

  if (!targetFrame) {
    add(
      rect(
        0,
        0,
        templateSize.width,
        templateSize.height,
        config.style === "executive" ? "#101113" : "#f8f9fa",
        "transparent",
      ),
    );
  }
  add(
    text(
      config.title || "Resource",
      72,
      56,
      44,
      config.style === "executive" ? "#f8f9fa" : "#212529",
    ),
  );

  if (config.resourceId === "bar-chart") {
    const chartLeft = 104;
    const chartBottom = 420;
    const slot = Math.min(112, 640 / Math.max(1, rows.length));
    add(
      line(
        [
          [88, chartBottom],
          [840, chartBottom],
        ],
        "#495057",
        3,
      ),
    );
    rows.forEach((row, index) => {
      const height = 42 + (values[index] / maxValue) * 230;
      add(
        rect(
          chartLeft + index * slot,
          chartBottom - height,
          slot * 0.52,
          height,
          colors[index % colors.length],
          "#212529",
          0.8,
        ),
      );
      add(text(row.label, chartLeft + index * slot - 2, 446, 18, "#495057"));
    });
  } else if (config.resourceId === "line-chart") {
    const points = rows.map((_, index) => [
      112 + index * (680 / Math.max(1, rows.length - 1)),
      410 - (values[index] / maxValue) * 245,
    ]) as [number, number][];
    add(
      line(
        [
          [96, 410],
          [820, 410],
        ],
        "#495057",
        3,
      ),
    );
    add(
      line(
        [
          [96, 410],
          [96, 142],
        ],
        "#495057",
        3,
      ),
    );
    add(line(points, colors[0], 4));
    points.forEach(([pointX, pointY], index) => {
      add(
        ellipse(
          pointX - 10,
          pointY - 10,
          20,
          20,
          colors[index % colors.length],
        ),
      );
      add(text(rows[index].label, pointX - 22, 442, 17, "#495057"));
    });
  } else if (config.resourceId === "area-chart") {
    const points = rows.map((_, index) => [
      112 + index * (680 / Math.max(1, rows.length - 1)),
      410 - (values[index] / maxValue) * 245,
    ]) as [number, number][];
    const baselineY = 410;
    const stripCount = 56;
    const stripWidth = 680 / stripCount;
    for (let stripIndex = 0; stripIndex < stripCount; stripIndex++) {
      const pointX = 112 + stripIndex * stripWidth;
      const segmentIndex = Math.min(
        points.length - 2,
        Math.max(
          0,
          Math.floor(
            ((pointX - points[0][0]) /
              (points[points.length - 1][0] - points[0][0])) *
              (points.length - 1),
          ),
        ),
      );
      const [startX, startY] = points[segmentIndex];
      const [endX, endY] = points[segmentIndex + 1] || points[segmentIndex];
      const progress =
        endX === startX ? 0 : (pointX - startX) / (endX - startX);
      const pointY = startY + (endY - startY) * progress;
      add(
        rect(
          pointX,
          pointY,
          stripWidth + 1,
          baselineY - pointY,
          colors[0],
          "transparent",
          0,
          34,
        ),
      );
    }
    add(line(points, colors[0], 4));
    rows.forEach((row, index) => {
      add(text(row.label, 92 + index * 150, 446, 17, "#495057"));
    });
  } else if (config.resourceId === "donut-chart") {
    const total = Math.max(
      1,
      values.reduce((sum, value) => sum + value, 0),
    );
    let angle = -90;
    rows.forEach((_, index) => {
      const nextAngle = angle + (values[index] / total) * 360;
      const arcPoints: [number, number][] = [];
      for (let step = 0; step <= 10; step++) {
        const currentAngle = angle + ((nextAngle - angle) * step) / 10;
        const radians = (currentAngle * Math.PI) / 180;
        arcPoints.push([
          310 + Math.cos(radians) * 120,
          290 + Math.sin(radians) * 120,
        ]);
      }
      add(line(arcPoints, colors[index % colors.length], 34));
      angle = nextAngle;
    });
    add(
      ellipse(
        226,
        206,
        168,
        168,
        config.style === "executive" ? "#101113" : "#f8f9fa",
      ),
    );
    rows.slice(0, 5).forEach((row, index) => {
      add(rect(520, 188 + index * 46, 28, 18, colors[index % colors.length]));
      add(
        text(
          `${row.label} · ${row.value}`,
          566,
          180 + index * 46,
          22,
          config.style === "executive" ? "#f8f9fa" : "#212529",
        ),
      );
    });
  } else if (config.resourceId === "kpi-cards") {
    rows.slice(0, 4).forEach((row, index) => {
      const colWidth = rows.length > 3 ? 190 : 240;
      add(
        rect(
          78 + index * (colWidth + 28),
          180,
          colWidth,
          190,
          "#ffffff",
          colors[index % colors.length],
          1,
        ),
      );
      add(
        text(
          row.value,
          108 + index * (colWidth + 28),
          224,
          44,
          colors[index % colors.length],
        ),
      );
      add(text(row.label, 110 + index * (colWidth + 28), 306, 23, "#495057"));
    });
  } else if (config.resourceId === "process") {
    rows.slice(0, 4).forEach((row, index) => {
      const pointX = 96 + index * 214;
      add(
        ellipse(
          pointX,
          204,
          96,
          96,
          colors[index % colors.length],
          "#212529",
          0.8,
        ),
      );
      add(text(`${index + 1}`, pointX + 34, 228, 34, "#101113"));
      add(
        text(
          row.label,
          pointX - 8,
          340,
          28,
          config.style === "executive" ? "#f8f9fa" : "#212529",
        ),
      );
      add(text(row.value, pointX - 8, 386, 17, "#868e96"));
      if (index < Math.min(rows.length, 4) - 1) {
        add(
          line(
            [
              [pointX + 116, 252],
              [pointX + 190, 252],
            ],
            "#868e96",
            4,
          ),
        );
      }
    });
  } else if (config.resourceId === "funnel") {
    rows.slice(0, 5).forEach((row, index) => {
      const width = 680 - index * 92;
      const left = 140 + index * 46;
      const top = 146 + index * 62;
      add(
        rect(
          left,
          top,
          width,
          46,
          colors[index % colors.length],
          "#212529",
          0.8,
          88,
        ),
      );
      add(text(row.label, left + 24, top + 10, 20, "#101113"));
      add(text(row.value, left + width - 96, top + 10, 20, "#101113"));
    });
  } else if (config.resourceId === "timeline") {
    add(
      line(
        [
          [112, 282],
          [826, 282],
        ],
        colors[0],
        5,
      ),
    );
    rows.forEach((row, index) => {
      const pointX = 132 + index * (650 / Math.max(1, rows.length - 1));
      add(
        ellipse(
          pointX - 22,
          260,
          44,
          44,
          colors[index % colors.length],
          "#212529",
          0.8,
        ),
      );
      add(
        text(
          row.label,
          pointX - 46,
          330,
          24,
          config.style === "executive" ? "#f8f9fa" : "#212529",
        ),
      );
      add(text(row.value, pointX - 38, 370, 18, "#868e96"));
    });
  } else if (config.resourceId === "matrix") {
    add(rect(96, 150, 760, 300, "#ffffff", "#212529", 1));
    add(
      line(
        [
          [476, 150],
          [476, 450],
        ],
        "#212529",
        3,
      ),
    );
    add(
      line(
        [
          [96, 300],
          [856, 300],
        ],
        "#212529",
        3,
      ),
    );
    rows.slice(0, 4).forEach((row, index) => {
      const col = index % 2;
      const rowIndex = Math.floor(index / 2);
      add(
        text(
          row.label,
          140 + col * 380,
          188 + rowIndex * 150,
          30,
          colors[index % colors.length],
        ),
      );
      add(
        text(row.value, 140 + col * 380, 246 + rowIndex * 150, 21, "#495057"),
      );
    });
  } else if (config.resourceId === "comparison-table") {
    add(rect(86, 140, 788, 318, "#ffffff", "#212529", 1));
    add(rect(86, 140, 788, 58, colors[0], "#212529", 0.8));
    add(text("Criteria", 122, 156, 23, "#101113"));
    add(text("Option A", 392, 156, 23, "#101113"));
    add(text("Option B", 650, 156, 23, "#101113"));
    rows.slice(0, 4).forEach((row, index) => {
      const top = 220 + index * 54;
      const [leftValue = row.value, rightValue = ""] = row.value.split("/");
      add(text(row.label, 122, top, 21, "#212529"));
      add(text(leftValue.trim(), 392, top, 21, "#495057"));
      add(text(rightValue.trim(), 650, top, 21, "#495057"));
      add(
        line(
          [
            [106, top + 38],
            [850, top + 38],
          ],
          "#dee2e6",
          2,
        ),
      );
    });
  } else if (config.resourceId === "roadmap") {
    rows.slice(0, 5).forEach((row, index) => {
      const left = 82 + index * 172;
      add(
        rect(left, 208, 138, 164, "#ffffff", colors[index % colors.length], 1),
      );
      add(
        rect(left, 208, 138, 36, colors[index % colors.length], "#212529", 0.8),
      );
      add(text(row.label, left + 28, 218, 20, "#101113"));
      add(text(row.value, left + 22, 286, 24, "#212529"));
      if (index < Math.min(rows.length, 5) - 1) {
        add(
          line(
            [
              [left + 146, 290],
              [left + 170, 290],
            ],
            "#868e96",
            3,
          ),
        );
      }
    });
  } else {
    rows.slice(0, 4).forEach((row, index) => {
      const left = 86 + index * 212;
      add(
        rect(left, 154, 174, 306, "#ffffff", colors[index % colors.length], 1),
      );
      add(text(row.label, left + 26, 196, 26, "#212529"));
      add(text(row.value, left + 30, 258, 38, colors[index % colors.length]));
      add(rect(left + 28, 336, 116, 10, "#adb5bd"));
      add(rect(left + 28, 374, 88, 10, "#ced4da"));
      add(rect(left + 28, 412, 132, 10, "#adb5bd"));
    });
  }

  return resourceElements;
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
  const presentationOperationRef = useRef<Promise<void>>(Promise.resolve());
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
  const [presentationIndex, setPresentationIndex] =
    useState<PresentationIndex | null>(null);
  const presentationIndexRef = useRef<PresentationIndex | null>(null);
  const [loadingPresentationId, setLoadingPresentationId] = useState<
    string | null
  >(null);
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
  const [presentationCanvasEmpty, setPresentationCanvasEmpty] = useState(true);
  const [presentationExportMenuOpen, setPresentationExportMenuOpen] =
    useState(false);
  const [presentationImporting, setPresentationImporting] = useState(false);
  const [presentationElements, setPresentationElements] = useState<
    readonly OrderedExcalidrawElement[]
  >([]);
  const [presentationAppState, setPresentationAppState] = useState<
    Partial<Omit<AppState, "offsetTop" | "offsetLeft">>
  >(() => getDefaultAppState());
  const [presentationFiles, setPresentationFiles] = useState<BinaryFiles>({});
  const [presentationAnimationMetadata, setPresentationAnimationMetadata] =
    useState<PresentationAnimationMetadata>(
      createPresentationAnimationMetadata,
    );
  const [framePresenter, setFramePresenter] =
    useState<FramePresenterState | null>(null);
  const [presentationLaserActive, setPresentationLaserActive] = useState(false);
  const [presentationTransitionActive, setPresentationTransitionActive] =
    useState(false);
  const [presentationFrameRect, setPresentationFrameRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const presentationCanvasOpenRef = useRef(presentationCanvasOpen);
  const presentationLoadingWorkspaceRef = useRef(false);
  const presentationIdRef = useRef<string | null>(null);
  const presentationImportInputRef = useRef<HTMLInputElement | null>(null);
  const presentationImportInFlightRef = useRef(false);
  const presentationSceneRef = useRef<PresentationScene | null>(null);
  const presentationCanvasEmptyRef = useRef(presentationCanvasEmpty);
  const presentationAnimationMetadataRef = useRef(
    presentationAnimationMetadata,
  );
  const presentationRuntimeActiveRef = useRef(false);
  const presentationRuntimeBaselineRef = useRef<
    readonly OrderedExcalidrawElement[]
  >([]);
  const presentationPlaybackGenerationRef = useRef(0);
  const presentationAnimationRunningRef = useRef(false);
  const framePresenterRef = useRef<FramePresenterState | null>(null);
  const presentationSlideCount = useMemo(
    () => getPresentationFrames(presentationElements).length,
    [presentationElements],
  );
  const isPresentationCanvasActive = presentationCanvasOpen && !kanbanOpen;
  const activePresentation = useMemo(
    () =>
      presentationIndex?.presentations.find(
        (presentation) =>
          presentation.id === presentationIndex.activePresentationId,
      ) || null,
    [presentationIndex],
  );
  const currentPresentationBuildCount = framePresenter
    ? getPresentationBuilds(
        presentationAnimationMetadata,
        framePresenter.frameIds[framePresenter.index] || "",
      ).length
    : 0;

  useEffect(() => {
    presentationAnimationMetadataRef.current = presentationAnimationMetadata;
  }, [presentationAnimationMetadata]);

  useEffect(() => {
    framePresenterRef.current = framePresenter;
  }, [framePresenter]);

  useEffect(() => {
    if (kanbanInvitationToken && drawsyAuth.status === "anonymous") {
      setErrorMessage(
        "Sign in with the invited email to join this Kanban board.",
      );
    }
  }, [drawsyAuth.status, kanbanInvitationToken]);

  useEffect(() => {
    if (!presentationExportMenuOpen) {
      return;
    }

    const closeExportMenu = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") {
        return;
      }

      if (
        event instanceof PointerEvent &&
        event.target instanceof Element &&
        event.target.closest(".presentation-quick-dock")
      ) {
        return;
      }

      setPresentationExportMenuOpen(false);
    };

    window.addEventListener("pointerdown", closeExportMenu);
    window.addEventListener("keydown", closeExportMenu);

    return () => {
      window.removeEventListener("pointerdown", closeExportMenu);
      window.removeEventListener("keydown", closeExportMenu);
    };
  }, [presentationExportMenuOpen]);

  useEffect(() => {
    if (!isPresentationCanvasActive) {
      setPresentationExportMenuOpen(false);
    }
  }, [isPresentationCanvasActive]);

  const selectPresentationFrameTool = useCallback(() => {
    excalidrawAPI?.setActiveTool({ type: "frame" });
  }, [excalidrawAPI]);

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

  const updatePresentationCanvasEmpty = useCallback(
    (elements: readonly ExcalidrawElement[] | null | undefined) => {
      const nextEmpty = isSceneEmptyForPresentation(elements);
      if (presentationCanvasEmptyRef.current !== nextEmpty) {
        presentationCanvasEmptyRef.current = nextEmpty;
        setPresentationCanvasEmpty(nextEmpty);
      }
    },
    [],
  );

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

  const commitPresentationIndex = useCallback((index: PresentationIndex) => {
    presentationIndexRef.current = index;
    presentationIdRef.current = index.activePresentationId;
    setPresentationIndex(index);
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

  const queuePresentationOperation = useCallback(
    <T,>(operation: () => Promise<T>): Promise<T> => {
      const result = presentationOperationRef.current.then(
        operation,
        operation,
      );
      presentationOperationRef.current = result.then(
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
        const presentations = await PresentationStore.initialize(
          createInitialPresentationScene(),
        );
        commitPresentationIndex(presentations.index);
        if (isPresentationRefresh) {
          const presentationScene = presentations.document.scene;
          presentationSceneRef.current = presentationScene;
          setPresentationAnimationMetadata(presentationScene.presentation);
          updatePresentationCanvasEmpty(presentationScene.elements);
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
        const presentations = await PresentationStore.initialize(
          createInitialPresentationScene(),
        );
        commitPresentationIndex(presentations.index);
        if (presentationCanvasOpenRef.current) {
          const presentationScene = presentations.document.scene;
          presentationSceneRef.current = presentationScene;
          setPresentationAnimationMetadata(presentationScene.presentation);
          data.scene = presentationScene;
        } else {
          data.scene = fallback.document.scene;
        }
        if (presentationCanvasOpenRef.current) {
          updatePresentationCanvasEmpty(data.scene.elements || []);
        }
      }
    },
    [
      commitWorkspaceIndex,
      commitPresentationIndex,
      drawsyAuth.user,
      updatePresentationCanvasEmpty,
      workspaceSync,
    ],
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
        void PresentationStore.flushSave(
          presentationIdRef.current,
          presentationSceneRef.current,
        );
        return;
      }
      LocalData.flushSave();
    };

    const visibilityChange = (event: FocusEvent | Event) => {
      if (event.type === EVENT.BLUR || document.hidden) {
        if (presentationCanvasOpenRef.current) {
          void PresentationStore.flushSave(
            presentationIdRef.current,
            presentationSceneRef.current,
          );
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
        void PresentationStore.flushSave(
          presentationIdRef.current,
          presentationSceneRef.current,
        );
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
    if (
      presentationCanvasOpenRef.current ||
      appState.openSidebar?.tab === "presentation"
    ) {
      setPresentationElements(elements);
      setPresentationAppState((currentAppState) =>
        currentAppState.selectedElementIds === appState.selectedElementIds &&
        currentAppState.viewBackgroundColor === appState.viewBackgroundColor &&
        currentAppState.exportWithDarkMode === appState.exportWithDarkMode
          ? currentAppState
          : appState,
      );
      setPresentationFiles(files);
    }

    if (presentationCanvasOpenRef.current) {
      updatePresentationCanvasEmpty(elements);
      if (
        !presentationLoadingWorkspaceRef.current &&
        !presentationRuntimeActiveRef.current
      ) {
        const nextMetadata = sanitizePresentationAnimationMetadata(
          presentationAnimationMetadataRef.current,
          elements,
        );
        if (
          !arePresentationAnimationMetadataEqual(
            presentationAnimationMetadataRef.current,
            nextMetadata,
          )
        ) {
          presentationAnimationMetadataRef.current = nextMetadata;
          setPresentationAnimationMetadata(nextMetadata);
        }
        const scene: PresentationScene = {
          elements,
          appState,
          files,
          presentation: nextMetadata,
        };
        presentationSceneRef.current = scene;
        if (presentationIdRef.current) {
          PresentationStore.saveScene(presentationIdRef.current, scene);
        }
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

  const createBlankPresentationScene = useCallback((): PresentationScene => {
    const scene = createBlankScene();
    return {
      ...scene,
      appState: {
        ...scene.appState,
        name: "Untitled presentation",
      },
      presentation: createPresentationAnimationMetadata(),
    };
  }, [createBlankScene]);

  const flushCurrentPresentation = useCallback(async () => {
    const presentationId = presentationIdRef.current;
    const scene = presentationSceneRef.current;
    if (presentationId && scene) {
      await PresentationStore.flushSave(presentationId, scene);
    }
  }, []);

  const saveCurrentWorkspaceBeforePresentation = useCallback(async () => {
    if (!excalidrawAPI || presentationCanvasOpenRef.current) {
      return true;
    }
    const activeCanvasId = workspaceIndexRef.current?.activeCanvasId;
    if (!activeCanvasId) {
      return true;
    }
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
      return true;
    } catch {
      setErrorMessage("Couldn't save the current canvas before presentation.");
      return false;
    }
  }, [excalidrawAPI, saveWorkspaceCanvas]);

  const applyPresentationDocument = useCallback(
    (document: PresentationDocument) => {
      if (!excalidrawAPI) {
        return;
      }

      presentationLoadingWorkspaceRef.current = true;
      presentationIdRef.current = document.id;
      presentationSceneRef.current = document.scene;
      setPresentationAnimationMetadata(document.scene.presentation);
      setPresentationElements(
        (document.scene.elements || []) as readonly OrderedExcalidrawElement[],
      );
      setPresentationAppState(document.scene.appState || {});
      setPresentationFiles(document.scene.files || {});
      updatePresentationCanvasEmpty(document.scene.elements || []);
      setPresentationCanvasActive(true);

      LocalData.pauseSave("workspace-switch");
      try {
        excalidrawAPI.resetScene({ resetLoadingState: true });
        excalidrawAPI.updateScene({
          elements: restoreElements(document.scene.elements, null, {
            repairBindings: true,
          }),
          appState: {
            ...restoreAppState(document.scene.appState, null),
            name: document.title,
            isLoading: false,
            openMenu: null,
            openSidebar: null,
          },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        excalidrawAPI.replaceFiles(document.scene.files || {});
        excalidrawAPI.history.clear();
      } finally {
        LocalData.resumeSave("workspace-switch");
        presentationLoadingWorkspaceRef.current = false;
      }
    },
    [excalidrawAPI, setPresentationCanvasActive, updatePresentationCanvasEmpty],
  );

  const openPresentationCanvas = useCallback(
    async (presentationId: string) => {
      if (!excalidrawAPI || collabAPI?.isCollaborating()) {
        excalidrawAPI?.setToast({
          message: "Leave collaboration before switching presentations.",
        });
        return;
      }
      if (
        presentationCanvasOpenRef.current &&
        presentationId === presentationIdRef.current
      ) {
        excalidrawAPI.updateScene({ appState: { openMenu: null } });
        return;
      }

      setLoadingPresentationId(presentationId);
      try {
        if (presentationCanvasOpenRef.current) {
          await flushCurrentPresentation();
        } else if (!(await saveCurrentWorkspaceBeforePresentation())) {
          return;
        }

        const index = presentationIndexRef.current;
        if (!index) {
          return;
        }
        const result = await queuePresentationOperation(() =>
          PresentationStore.openPresentation(index, presentationId),
        );
        if (!result) {
          excalidrawAPI.setToast({
            message: "That presentation is unavailable.",
          });
          return;
        }
        commitPresentationIndex(result.index);
        applyPresentationDocument(result.document);
      } catch (error) {
        console.error("Failed to switch presentation", error);
        excalidrawAPI.setToast({
          message: "Couldn't switch presentations. Your current work is safe.",
        });
      } finally {
        setLoadingPresentationId(null);
      }
    },
    [
      applyPresentationDocument,
      collabAPI,
      commitPresentationIndex,
      excalidrawAPI,
      flushCurrentPresentation,
      queuePresentationOperation,
      saveCurrentWorkspaceBeforePresentation,
    ],
  );

  const createPresentationCanvas = useCallback(async () => {
    if (!excalidrawAPI || collabAPI?.isCollaborating()) {
      excalidrawAPI?.setToast({
        message: "Leave collaboration before creating a presentation.",
      });
      return;
    }

    setLoadingPresentationId("new-presentation");
    try {
      if (presentationCanvasOpenRef.current) {
        await flushCurrentPresentation();
      } else if (!(await saveCurrentWorkspaceBeforePresentation())) {
        return;
      }

      const index = presentationIndexRef.current;
      if (!index) {
        return;
      }
      const result = await queuePresentationOperation(() =>
        PresentationStore.createPresentation(
          index,
          createBlankPresentationScene(),
        ),
      );
      commitPresentationIndex(result.index);
      applyPresentationDocument(result.document);
    } catch (error) {
      console.error("Failed to create presentation", error);
      excalidrawAPI.setToast({ message: "Couldn't create a presentation." });
    } finally {
      setLoadingPresentationId(null);
    }
  }, [
    applyPresentationDocument,
    collabAPI,
    commitPresentationIndex,
    createBlankPresentationScene,
    excalidrawAPI,
    flushCurrentPresentation,
    queuePresentationOperation,
    saveCurrentWorkspaceBeforePresentation,
  ]);

  const deletePresentationCanvas = useCallback(
    async (presentationId: string) => {
      if (collabAPI?.isCollaborating()) {
        return false;
      }
      const index = presentationIndexRef.current;
      if (!index) {
        return false;
      }

      setLoadingPresentationId(presentationId);
      try {
        const wasActive = index.activePresentationId === presentationId;
        if (wasActive && presentationCanvasOpenRef.current) {
          await flushCurrentPresentation();
        }
        const result = await queuePresentationOperation(() =>
          PresentationStore.deletePresentation(
            index,
            presentationId,
            createBlankPresentationScene(),
          ),
        );
        if (!result) {
          return false;
        }
        commitPresentationIndex(result.index);
        if (wasActive && presentationCanvasOpenRef.current) {
          applyPresentationDocument(result.document);
        }
        return true;
      } catch (error) {
        console.error("Failed to delete presentation", error);
        return false;
      } finally {
        setLoadingPresentationId(null);
      }
    },
    [
      applyPresentationDocument,
      collabAPI,
      commitPresentationIndex,
      createBlankPresentationScene,
      flushCurrentPresentation,
      queuePresentationOperation,
    ],
  );

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
    canvasId: isPresentationCanvasActive ? null : activeCanvas?.id || null,
    enabled: !!activeCanvas && !isCollaborating && !isPresentationCanvasActive,
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

  const openPresentationPanel = useCallback(() => {
    setPresentationElements(excalidrawAPI?.getSceneElements() || []);
    setPresentationAppState(
      excalidrawAPI?.getAppState() || getDefaultAppState(),
    );
    setPresentationFiles(excalidrawAPI?.getFiles() || {});
    excalidrawAPI?.updateScene({
      appState: {
        openSidebar: {
          name: DEFAULT_SIDEBAR.name,
          tab: "presentation",
        },
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }, [excalidrawAPI]);

  const updatePresentationFrameMask = useCallback(
    (frameId: string) => {
      if (!excalidrawAPI) {
        return;
      }
      const frame = excalidrawAPI
        .getSceneElements()
        .find(
          (element) => element.id === frameId && isFrameLikeElement(element),
        ) as ExcalidrawFrameLikeElement | undefined;
      if (!frame) {
        setPresentationFrameRect(null);
        return;
      }

      const appState = excalidrawAPI.getAppState();
      const topLeft = sceneCoordsToViewportCoords(
        { sceneX: frame.x, sceneY: frame.y },
        appState,
      );
      const bottomRight = sceneCoordsToViewportCoords(
        { sceneX: frame.x + frame.width, sceneY: frame.y + frame.height },
        appState,
      );

      setPresentationFrameRect({
        left: topLeft.x,
        top: topLeft.y,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y,
      });
    },
    [excalidrawAPI],
  );

  const focusPresentationSlide = useCallback(
    (frameId: string, animate = true, viewportZoomFactor = 0.82) => {
      if (!excalidrawAPI) {
        return;
      }
      const frame = excalidrawAPI
        .getSceneElements()
        .find(
          (element) => element.id === frameId && isFrameLikeElement(element),
        ) as ExcalidrawFrameLikeElement | undefined;

      if (!frame) {
        setPresentationFrameRect(null);
        return;
      }

      excalidrawAPI.scrollToContent(frame, {
        fitToViewport: true,
        viewportZoomFactor,
        animate,
      });
      requestAnimationFrame(() => updatePresentationFrameMask(frameId));
      window.setTimeout(
        () => updatePresentationFrameMask(frameId),
        animate ? 260 : 0,
      );
    },
    [excalidrawAPI, updatePresentationFrameMask],
  );

  const savePresentationAnimationMetadata = useCallback(
    (metadata: PresentationAnimationMetadata) => {
      if (!presentationCanvasOpenRef.current) {
        return;
      }

      const elements =
        excalidrawAPI?.getSceneElementsIncludingDeleted() ||
        presentationSceneRef.current?.elements ||
        [];
      const nextMetadata = sanitizePresentationAnimationMetadata(
        metadata,
        elements,
      );
      presentationAnimationMetadataRef.current = nextMetadata;
      setPresentationAnimationMetadata(nextMetadata);

      const currentScene = presentationSceneRef.current;
      if (!currentScene) {
        return;
      }

      const nextScene: PresentationScene = {
        ...currentScene,
        presentation: nextMetadata,
      };
      presentationSceneRef.current = nextScene;
      if (presentationIdRef.current) {
        PresentationStore.saveScene(presentationIdRef.current, nextScene);
      }
    },
    [excalidrawAPI],
  );

  const addPresentationBuild = useCallback(
    (build: Omit<PresentationBuild, "id">) => {
      if (!excalidrawAPI || !presentationCanvasOpenRef.current) {
        return;
      }

      const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
      const elementById = new Map(
        elements.map((element) => [element.id, element]),
      );
      const targetIds = [...new Set(build.targetIds)].filter((targetId) => {
        const target = elementById.get(targetId);
        return (
          !!target &&
          !target.isDeleted &&
          !isFrameLikeElement(target) &&
          getPresentationTargetFrameId(target, elements) === build.frameId
        );
      });

      if (!targetIds.length) {
        return;
      }

      const existingBuilds = getPresentationBuilds(
        presentationAnimationMetadataRef.current,
        build.frameId,
      );
      const existingTargetIds = new Set(
        existingBuilds.flatMap((existingBuild) => existingBuild.targetIds),
      );
      if (targetIds.some((targetId) => existingTargetIds.has(targetId))) {
        excalidrawAPI.setToast({
          message: "Each object can have one entrance build.",
        });
        return;
      }
      const nextBuild: PresentationBuild = {
        ...build,
        id: randomId(),
        targetIds,
        trigger: existingBuilds.length === 0 ? "on-click" : build.trigger,
      };

      savePresentationAnimationMetadata({
        ...presentationAnimationMetadataRef.current,
        builds: [...presentationAnimationMetadataRef.current.builds, nextBuild],
      });
    },
    [excalidrawAPI, savePresentationAnimationMetadata],
  );

  const deletePresentationBuild = useCallback(
    (buildId: string) => {
      savePresentationAnimationMetadata({
        ...presentationAnimationMetadataRef.current,
        builds: presentationAnimationMetadataRef.current.builds.filter(
          (build) => build.id !== buildId,
        ),
      });
    },
    [savePresentationAnimationMetadata],
  );

  const setPresentationSlideTransition = useCallback(
    (frameId: string, transition: PresentationSlideTransition) => {
      const transitions = {
        ...presentationAnimationMetadataRef.current.transitions,
      };

      if (transition === "none") {
        delete transitions[frameId];
      } else {
        transitions[frameId] = transition;
      }

      savePresentationAnimationMetadata({
        ...presentationAnimationMetadataRef.current,
        transitions,
      });
    },
    [savePresentationAnimationMetadata],
  );

  const arrangePresentationFrames = useCallback(
    (layout: PresentationLayout) => {
      if (!excalidrawAPI || layout === "freeform") {
        return;
      }

      const currentElements = excalidrawAPI.getSceneElementsIncludingDeleted();
      const nextElements = getArrangedPresentationElements(
        currentElements,
        layout,
      );

      if (!nextElements) {
        return;
      }

      excalidrawAPI.updateScene({
        elements: nextElements,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      setPresentationElements(excalidrawAPI.getSceneElements());
    },
    [excalidrawAPI],
  );

  const insertPresentationTemplate = useCallback(
    (templateId: PresentationTemplateId, layout: PresentationLayout) => {
      if (!excalidrawAPI) {
        return;
      }

      const currentElements = excalidrawAPI.getSceneElementsIncludingDeleted();
      const appState = excalidrawAPI.getAppState();
      const frames = getPresentationFrames(excalidrawAPI.getSceneElements());
      const origin = getPresentationTemplateOrigin(frames, layout, appState);
      const templateElements = createPresentationTemplateElements(
        templateId,
        origin,
      );
      const insertedFrame = templateElements.find(isFrameLikeElement);
      const elementsWithTemplate = [...currentElements, ...templateElements];
      const nextElements =
        getArrangedPresentationElements(elementsWithTemplate, layout) ||
        elementsWithTemplate;

      excalidrawAPI.updateScene({
        elements: nextElements,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      if (insertedFrame) {
        requestAnimationFrame(() => focusPresentationSlide(insertedFrame.id));
      }
      setPresentationElements(excalidrawAPI.getSceneElements());
    },
    [excalidrawAPI, focusPresentationSlide],
  );

  const insertPresentationResource = useCallback(
    (config: PresentationResourceConfig, layout: PresentationLayout) => {
      if (!excalidrawAPI) {
        return;
      }

      const currentElements = excalidrawAPI.getSceneElementsIncludingDeleted();
      const visibleElements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const selectedFrameIds = new Set(
        Object.keys(appState.selectedElementIds),
      );
      const selectedFrame =
        selectedFrameIds.size === 1
          ? (visibleElements.find(
              (element) =>
                selectedFrameIds.has(element.id) && isFrameLikeElement(element),
            ) as ExcalidrawFrameLikeElement | undefined)
          : undefined;
      const frames = getPresentationFrames(visibleElements);
      const origin = getPresentationTemplateOrigin(frames, layout, appState);
      const resourceElements = createPresentationResourceElements(
        config,
        origin,
        selectedFrame,
      );
      const insertedFrame =
        selectedFrame || resourceElements.find(isFrameLikeElement);
      const elementsWithResource = [...currentElements, ...resourceElements];
      const nextElements =
        selectedFrame || layout === "freeform"
          ? elementsWithResource
          : getArrangedPresentationElements(elementsWithResource, layout) ||
            elementsWithResource;

      excalidrawAPI.updateScene({
        elements: nextElements,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });

      if (insertedFrame) {
        requestAnimationFrame(() => focusPresentationSlide(insertedFrame.id));
      }
      setPresentationElements(excalidrawAPI.getSceneElements());
    },
    [excalidrawAPI, focusPresentationSlide],
  );

  const renamePresentationSlide = useCallback(
    (frameId: string, name: string) => {
      if (!excalidrawAPI) {
        return;
      }

      const currentElements = excalidrawAPI.getSceneElementsIncludingDeleted();
      const nextElements = currentElements.map((element) => {
        if (element.id !== frameId || !isFrameLikeElement(element)) {
          return element;
        }

        return newElementWith(element, { name });
      });

      excalidrawAPI.updateScene({
        elements: nextElements,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      setPresentationElements(excalidrawAPI.getSceneElements());
    },
    [excalidrawAPI],
  );

  const deletePresentationSlide = useCallback(
    (frameId: string, layout: PresentationLayout) => {
      if (!excalidrawAPI) {
        return;
      }

      const currentElements = excalidrawAPI.getSceneElementsIncludingDeleted();
      const deletedElements = currentElements.map((element) => {
        if (element.id === frameId || element.frameId === frameId) {
          return newElementWith(element, { isDeleted: true });
        }

        return element;
      });
      const nextElements =
        layout === "freeform"
          ? deletedElements
          : getArrangedPresentationElements(deletedElements, layout) ||
            deletedElements;

      excalidrawAPI.updateScene({
        elements: nextElements,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      setPresentationElements(excalidrawAPI.getSceneElements());
    },
    [excalidrawAPI],
  );

  const reorderPresentationSlide = useCallback(
    (frameId: string, targetFrameId: string, layout: PresentationLayout) => {
      if (!excalidrawAPI) {
        return;
      }

      const currentElements = excalidrawAPI.getSceneElementsIncludingDeleted();
      const frames = getPresentationFrames(excalidrawAPI.getSceneElements());
      const frameIndex = frames.findIndex((frame) => frame.id === frameId);
      const targetIndex = frames.findIndex(
        (frame) => frame.id === targetFrameId,
      );

      if (frameIndex < 0 || targetIndex < 0 || frameIndex === targetIndex) {
        return;
      }

      const reorderedFrames = [...frames];
      const [movedFrame] = reorderedFrames.splice(frameIndex, 1);
      reorderedFrames.splice(targetIndex, 0, movedFrame);
      const frameOffsets = new Map<string, { dx: number; dy: number }>();

      reorderedFrames.forEach((frame, index) => {
        const targetPosition = frames[index];
        frameOffsets.set(frame.id, {
          dx: targetPosition.x - frame.x,
          dy: targetPosition.y - frame.y,
        });
      });

      const reorderedElements = currentElements.map((element) => {
        const offset = isFrameLikeElement(element)
          ? frameOffsets.get(element.id)
          : element.frameId
          ? frameOffsets.get(element.frameId)
          : null;

        if (!offset || (!offset.dx && !offset.dy)) {
          return element;
        }

        return newElementWith(element, {
          x: element.x + offset.dx,
          y: element.y + offset.dy,
        });
      });
      const nextElements =
        layout === "freeform"
          ? reorderedElements
          : getArrangedPresentationElements(reorderedElements, layout) ||
            reorderedElements;

      excalidrawAPI.updateScene({
        elements: nextElements,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      setPresentationElements(excalidrawAPI.getSceneElements());
    },
    [excalidrawAPI],
  );

  const commitFramePresenter = useCallback(
    (nextPresenter: FramePresenterState | null) => {
      framePresenterRef.current = nextPresenter;
      setFramePresenter(nextPresenter);
    },
    [],
  );

  const applyPresentationBuildState = useCallback(
    (frameId: string, completedBuildCount: number) => {
      if (!excalidrawAPI) {
        return;
      }

      const baseline = presentationRuntimeBaselineRef.current;
      if (!baseline.length) {
        return;
      }

      const hiddenTargetIds = getHiddenPresentationBuildTargetIds(
        presentationAnimationMetadataRef.current,
        frameId,
        completedBuildCount,
      );
      excalidrawAPI.updateScene({
        elements: baseline.map((element) =>
          hiddenTargetIds.has(element.id)
            ? newElementWith(element, { opacity: 0 })
            : element,
        ),
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    },
    [excalidrawAPI],
  );

  const runPresentationBuild = useCallback(
    async (build: PresentationBuild) => {
      if (!excalidrawAPI) {
        return;
      }

      const baselineById = new Map(
        presentationRuntimeBaselineRef.current.map((element) => [
          element.id,
          element,
        ]),
      );
      const targetIds = build.targetIds.filter((targetId) =>
        baselineById.has(targetId),
      );

      if (!targetIds.length) {
        return;
      }

      const applyFrame = (progress: number) => {
        const easedProgress = 1 - (1 - progress) ** 3;
        const currentElements =
          excalidrawAPI.getSceneElementsIncludingDeleted();
        excalidrawAPI.updateScene({
          elements: currentElements.map((element) => {
            const baselineElement = baselineById.get(element.id);
            if (!baselineElement || !targetIds.includes(element.id)) {
              return element;
            }

            if (progress === 1) {
              return baselineElement;
            }

            const travel = Math.min(
              180,
              Math.max(
                48,
                Math.max(baselineElement.width, baselineElement.height) * 0.2,
              ),
            );
            const offset =
              build.effect === "fly"
                ? {
                    left: { x: -travel, y: 0 },
                    right: { x: travel, y: 0 },
                    up: { x: 0, y: -travel },
                    down: { x: 0, y: travel },
                  }[build.direction]
                : { x: 0, y: 0 };

            return newElementWith(element, {
              x: baselineElement.x + offset.x * (1 - easedProgress),
              y: baselineElement.y + offset.y * (1 - easedProgress),
              opacity: baselineElement.opacity * easedProgress,
            });
          }),
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      };

      if (build.effect === "appear") {
        applyFrame(1);
        return;
      }

      const generation = presentationPlaybackGenerationRef.current;
      await new Promise<void>((resolve) => {
        const startedAt = performance.now();
        const animate = (timestamp: number) => {
          if (generation !== presentationPlaybackGenerationRef.current) {
            resolve();
            return;
          }

          const progress = Math.min(
            1,
            (timestamp - startedAt) / PRESENTATION_BUILD_DURATION_MS,
          );
          applyFrame(progress);

          if (progress === 1) {
            resolve();
            return;
          }
          requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
      });
    },
    [excalidrawAPI],
  );

  const transitionToPresentationSlide = useCallback(
    async (
      currentPresenter: FramePresenterState,
      index: number,
      completedBuildCount: number,
    ) => {
      const frameId = currentPresenter.frameIds[index];
      if (!frameId) {
        return;
      }

      const transition =
        presentationAnimationMetadataRef.current.transitions[frameId] || "none";
      if (transition === "fade") {
        setPresentationTransitionActive(true);
        await waitForPresentationDuration(PRESENTATION_SLIDE_FADE_DURATION_MS);
      }

      applyPresentationBuildState(frameId, completedBuildCount);
      focusPresentationSlide(frameId, transition !== "fade", 1);
      commitFramePresenter({
        ...currentPresenter,
        index,
        completedBuildCount,
      });

      if (transition === "fade") {
        requestAnimationFrame(() => setPresentationTransitionActive(false));
      }
    },
    [applyPresentationBuildState, commitFramePresenter, focusPresentationSlide],
  );

  const endFramePresentation = useCallback(() => {
    presentationPlaybackGenerationRef.current += 1;
    presentationAnimationRunningRef.current = false;
    const currentPresenter = framePresenterRef.current;
    const baseline = presentationRuntimeBaselineRef.current;

    if (currentPresenter && excalidrawAPI) {
      excalidrawAPI.updateFrameRendering(
        currentPresenter.previousView.frameRendering,
      );
      excalidrawAPI.updateScene({
        elements: baseline.length ? baseline : undefined,
        appState: currentPresenter.previousView,
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      const restoredScene: PresentationScene = {
        elements: baseline.length
          ? baseline
          : excalidrawAPI.getSceneElementsIncludingDeleted(),
        appState: excalidrawAPI.getAppState(),
        files: excalidrawAPI.getFiles(),
        presentation: presentationAnimationMetadataRef.current,
      };
      presentationSceneRef.current = restoredScene;
      if (presentationIdRef.current) {
        PresentationStore.saveScene(presentationIdRef.current, restoredScene);
      }
      setPresentationElements(excalidrawAPI.getSceneElements());
      setPresentationAppState(excalidrawAPI.getAppState());
      setPresentationFiles(excalidrawAPI.getFiles());
    }

    presentationRuntimeActiveRef.current = false;
    presentationRuntimeBaselineRef.current = [];
    commitFramePresenter(null);
    setPresentationLaserActive(false);
    setPresentationTransitionActive(false);
    setPresentationFrameRect(null);

    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }, [commitFramePresenter, excalidrawAPI]);

  const startFramePresentation = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }

    const frames = getPresentationFrames(excalidrawAPI.getSceneElements());
    if (!frames.length) {
      excalidrawAPI.setToast({
        message: "Add a frame around canvas content to create the first slide.",
      });
      return;
    }

    const appState = excalidrawAPI.getAppState();
    const currentPresenter: FramePresenterState = {
      frameIds: frames.map((frame) => frame.id),
      index: 0,
      completedBuildCount: 0,
      previousView: {
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
        zoom: appState.zoom,
        openSidebar: appState.openSidebar,
        openMenu: appState.openMenu,
        viewModeEnabled: appState.viewModeEnabled,
        activeTool: appState.activeTool,
        frameRendering: appState.frameRendering,
      },
    };
    presentationRuntimeBaselineRef.current =
      excalidrawAPI.getSceneElementsIncludingDeleted();
    presentationPlaybackGenerationRef.current += 1;
    presentationRuntimeActiveRef.current = true;
    presentationAnimationRunningRef.current = false;
    commitFramePresenter(currentPresenter);
    excalidrawAPI.updateFrameRendering({
      enabled: true,
      clip: true,
      name: false,
      outline: false,
    });
    excalidrawAPI.updateScene({
      appState: {
        openSidebar: null,
        openMenu: null,
        viewModeEnabled: true,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    applyPresentationBuildState(frames[0].id, 0);
    const focusFirstFrame = () =>
      focusPresentationSlide(frames[0].id, false, 1);
    focusFirstFrame();
    const fullscreenRequest = document.documentElement.requestFullscreen?.();
    if (fullscreenRequest) {
      void fullscreenRequest
        .then(() => requestAnimationFrame(focusFirstFrame))
        .catch(() => undefined);
    }
  }, [
    applyPresentationBuildState,
    commitFramePresenter,
    excalidrawAPI,
    focusPresentationSlide,
  ]);

  const exportPresentation = useCallback(
    async (format: PresentationExportFormat) => {
      if (!excalidrawAPI) {
        return;
      }

      setPresentationExportMenuOpen(false);
      const elements = excalidrawAPI.getSceneElements();
      const frames = getPresentationFrames(elements);

      if (!frames.length) {
        excalidrawAPI.setToast({
          message: "Add frames before exporting the presentation.",
        });
        return;
      }

      try {
        excalidrawAPI.setToast({ message: "Exporting presentation..." });
        const appState = excalidrawAPI.getAppState();
        const files = excalidrawAPI.getFiles();
        const exportElements = getNonDeletedElements(elements);
        const slides = await Promise.all(
          frames.map(async (frame, index) => {
            const canvas = await exportToCanvas({
              elements: exportElements,
              appState: {
                ...appState,
                exportBackground: true,
                exportScale: 1,
              },
              files,
              exportingFrame: frame,
              exportPadding: 0,
              maxWidthOrHeight: 1920,
            });
            const png = await blobToBytes(await canvasToBlob(canvas));
            const rgb = canvasToRgbBytes(canvas);

            return {
              title: frame.name?.trim() || `Slide ${index + 1}`,
              width: canvas.width,
              height: canvas.height,
              png,
              rgb,
            };
          }),
        );

        if (format === "pngZip") {
          const zip = createZipBlob(
            slides.map((slide, index) => ({
              name: `slide-${`${index + 1}`.padStart(2, "0")}.png`,
              data: slide.png,
            })),
          );
          savePresentationBlob(
            new Blob([await zip.arrayBuffer()], { type: "application/zip" }),
            "drawsy-presentation-slides.zip",
          );
        } else if (format === "pdf") {
          savePresentationBlob(
            createPresentationPdf(slides),
            "drawsy-presentation.pdf",
          );
        } else if (format === "pptx") {
          const pptx = createPresentationPptx(slides);
          savePresentationBlob(
            new Blob([await pptx.arrayBuffer()], {
              type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            }),
            "drawsy-presentation.pptx",
          );
        } else if (format === "docx") {
          const docx = createPresentationDocx(slides);
          savePresentationBlob(
            new Blob([await docx.arrayBuffer()], {
              type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            }),
            "drawsy-presentation.docx",
          );
        }

        excalidrawAPI.setToast({ message: "Presentation exported." });
      } catch (error: any) {
        excalidrawAPI.setToast({
          message: error?.message || "Could not export presentation.",
        });
      }
    },
    [excalidrawAPI],
  );

  const importPresentationPptx = useCallback(
    async (file: File) => {
      if (!excalidrawAPI || presentationImportInFlightRef.current) {
        return;
      }

      setPresentationExportMenuOpen(false);
      presentationImportInFlightRef.current = true;
      setPresentationImporting(true);
      const presentationId = presentationIdRef.current;

      try {
        excalidrawAPI.setToast({ message: "Importing PowerPoint..." });
        const frames = getPresentationFrames(excalidrawAPI.getSceneElements());
        const result = await importPptxPresentation(file, {
          origin: getPresentationTemplateOrigin(
            frames,
            "horizontal",
            excalidrawAPI.getAppState(),
          ),
        });

        if (
          !presentationCanvasOpenRef.current ||
          presentationIdRef.current !== presentationId ||
          presentationRuntimeActiveRef.current
        ) {
          return;
        }

        excalidrawAPI.addFiles(result.files);
        excalidrawAPI.updateScene({
          elements: [
            ...excalidrawAPI.getSceneElementsIncludingDeleted(),
            ...result.elements,
          ],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        setPresentationElements(excalidrawAPI.getSceneElements());

        const unsupportedCount = Object.values(result.unsupported).reduce(
          (total, count) => total + count,
          0,
        );
        const flattenedCount = Object.values(result.flattened).reduce(
          (total, count) => total + count,
          0,
        );
        const notes = [
          unsupportedCount
            ? `${unsupportedCount} PowerPoint-only object${
                unsupportedCount === 1 ? " was" : "s were"
              } omitted`
            : null,
          flattenedCount
            ? `${flattenedCount} visual effect${
                flattenedCount === 1 ? " was" : "s were"
              } simplified`
            : null,
        ].filter(Boolean);

        excalidrawAPI.setToast({
          message: `Imported ${result.slideCount} ${
            result.slideCount === 1 ? "slide" : "slides"
          } as editable canvas content${
            notes.length ? `. ${notes.join("; ")}.` : "."
          }`,
        });
      } catch (error: any) {
        excalidrawAPI.setToast({
          message: error?.message || "Could not import that PowerPoint file.",
        });
      } finally {
        presentationImportInFlightRef.current = false;
        setPresentationImporting(false);
      }
    },
    [excalidrawAPI],
  );

  const goToPresentationStep = useCallback(
    async (direction: -1 | 1) => {
      const currentPresenter = framePresenterRef.current;
      if (!currentPresenter || presentationAnimationRunningRef.current) {
        return;
      }

      const frameId = currentPresenter.frameIds[currentPresenter.index];
      const builds = getPresentationBuilds(
        presentationAnimationMetadataRef.current,
        frameId,
      );

      if (direction === -1) {
        if (currentPresenter.completedBuildCount > 0) {
          const previousBuildCount = getPreviousPresentationBuildCount(
            builds,
            currentPresenter.completedBuildCount,
          );
          applyPresentationBuildState(frameId, previousBuildCount);
          commitFramePresenter({
            ...currentPresenter,
            completedBuildCount: previousBuildCount,
          });
          return;
        }

        const previousIndex = currentPresenter.index - 1;
        if (previousIndex < 0) {
          return;
        }

        const previousFrameId = currentPresenter.frameIds[previousIndex];
        const previousBuilds = getPresentationBuilds(
          presentationAnimationMetadataRef.current,
          previousFrameId,
        );
        await transitionToPresentationSlide(
          currentPresenter,
          previousIndex,
          previousBuilds.length,
        );
        return;
      }

      const sequence = getPresentationBuildSequence(
        builds,
        currentPresenter.completedBuildCount,
      );
      if (sequence) {
        presentationAnimationRunningRef.current = true;
        try {
          for (const stage of sequence.stages) {
            await Promise.all(
              stage.map((build) => runPresentationBuild(build)),
            );
          }
          if (framePresenterRef.current === currentPresenter) {
            commitFramePresenter({
              ...currentPresenter,
              completedBuildCount: sequence.completedBuildCount,
            });
          }
        } finally {
          presentationAnimationRunningRef.current = false;
        }
        return;
      }

      const nextIndex = currentPresenter.index + 1;
      if (nextIndex >= currentPresenter.frameIds.length) {
        return;
      }

      await transitionToPresentationSlide(currentPresenter, nextIndex, 0);
    },
    [
      applyPresentationBuildState,
      commitFramePresenter,
      runPresentationBuild,
      transitionToPresentationSlide,
    ],
  );

  const togglePresentationTheme = useCallback(() => {
    const frameId = framePresenter?.frameIds[framePresenter.index];
    setAppTheme(editorTheme === THEME.DARK ? THEME.LIGHT : THEME.DARK);
    if (frameId) {
      requestAnimationFrame(() => focusPresentationSlide(frameId, false, 1));
    }
  }, [editorTheme, focusPresentationSlide, framePresenter, setAppTheme]);

  const activatePresentationLaser = useCallback(() => {
    setPresentationLaserActive((currentValue) => {
      const nextValue = !currentValue;
      excalidrawAPI?.setActiveTool({
        type: nextValue ? "laser" : "selection",
      });
      if (!nextValue) {
        const frameId = framePresenter?.frameIds[framePresenter.index];
        if (frameId) {
          requestAnimationFrame(() =>
            focusPresentationSlide(frameId, false, 1),
          );
        }
      }
      return nextValue;
    });
  }, [excalidrawAPI, focusPresentationSlide, framePresenter]);

  useEffect(() => {
    if (!framePresenter) {
      return;
    }

    const frameId = framePresenter.frameIds[framePresenter.index];
    updatePresentationFrameMask(frameId);

    const onResize = () => {
      requestAnimationFrame(() => updatePresentationFrameMask(frameId));
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [
    framePresenter,
    presentationAppState.height,
    presentationAppState.scrollX,
    presentationAppState.scrollY,
    presentationAppState.width,
    presentationAppState.zoom,
    updatePresentationFrameMask,
  ]);

  useEffect(() => {
    if (!framePresenter) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        endFramePresentation();
      } else if (
        event.key === "ArrowRight" ||
        event.key === "PageDown" ||
        event.key === " "
      ) {
        event.preventDefault();
        event.stopPropagation();
        void goToPresentationStep(1);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        event.stopPropagation();
        void goToPresentationStep(-1);
      } else {
        event.stopPropagation();
        if (!event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
        }
      }
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("wheel", onWheel, {
      capture: true,
      passive: false,
    });
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("wheel", onWheel, true);
    };
  }, [endFramePresentation, framePresenter, goToPresentationStep]);

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

  const renameActivePresentation = useCallback(
    (title: string) => {
      const index = presentationIndexRef.current;
      const presentationId = presentationIdRef.current;
      if (!index || !presentationId) {
        return;
      }

      const current = index.presentations.find(
        (presentation) => presentation.id === presentationId,
      );
      if (!current) {
        return;
      }
      const normalizedTitle = title.trim() || current.title;
      const nextIndex: PresentationIndex = {
        ...index,
        presentations: index.presentations.map((presentation) =>
          presentation.id === presentationId
            ? {
                ...presentation,
                title: normalizedTitle,
                updatedAt: Date.now(),
              }
            : presentation,
        ),
      };
      commitPresentationIndex(nextIndex);

      const currentScene = presentationSceneRef.current;
      if (currentScene) {
        presentationSceneRef.current = {
          ...currentScene,
          appState: { ...currentScene.appState, name: normalizedTitle },
        };
      }
      excalidrawAPI?.updateScene({
        appState: { name: normalizedTitle },
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      void queuePresentationOperation(async () => {
        const persistedIndex = await PresentationStore.renamePresentation(
          nextIndex,
          presentationId,
          normalizedTitle,
        );
        commitPresentationIndex(persistedIndex);
      }).catch((error) => {
        console.error("Failed to rename presentation", error);
        excalidrawAPI?.setToast({ message: "Couldn't rename presentation." });
      });
    },
    [commitPresentationIndex, excalidrawAPI, queuePresentationOperation],
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
        "is-frame-presenter-open": !!framePresenter,
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
          if (
            framePresenter ||
            isMobile ||
            (!kanbanOpen && (!collabAPI || isCollabDisabled))
          ) {
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
                  onPresentationSelect={openPresentationPanel}
                  isPlacingComment={isPlacingComment}
                  isKanbanOpen={kanbanOpen}
                  isPresentationOpen={isPresentationCanvasActive}
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
        {!framePresenter && (
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
                presentationIndex={presentationIndex}
                presentationActive={isPresentationCanvasActive}
                disabled={
                  !workspaceIndex || !presentationIndex || isCollaborating
                }
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
                  setPresentationCanvasActive(false);
                  setKanbanWorkspaceActive(true);
                }}
                onCreatePresentation={() => {
                  setCommentPlacement(false);
                  setCommentDraftAnchor(null);
                  setCommentsSidebarOpen(false);
                  setKanbanWorkspaceActive(false);
                  void createPresentationCanvas();
                }}
                onOpenPresentation={(presentationId) => {
                  setCommentPlacement(false);
                  setCommentDraftAnchor(null);
                  setCommentsSidebarOpen(false);
                  setKanbanWorkspaceActive(false);
                  void openPresentationCanvas(presentationId);
                }}
                onDeletePresentation={deletePresentationCanvas}
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
                loadingPresentationId={loadingPresentationId}
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
              ) : isPresentationCanvasActive ? (
                <WorkspaceTitle
                  canvasTitle={activePresentation?.title || "Presentation"}
                  projectTitle={null}
                  focusProjectTitle={false}
                  itemLabel="Presentation"
                  onCanvasTitleChange={renameActivePresentation}
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
        )}
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
        {!kanbanOpen &&
          (!isPresentationCanvasActive || presentationCanvasEmpty) && (
            <AppWelcomeScreen
              onCollabDialogOpen={onCollabDialogOpen}
              isCollabEnabled={!isCollabDisabled}
              isPresentationMode={isPresentationCanvasActive}
              onOpenPresentationPanel={openPresentationPanel}
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
        {excalidrawAPI && !framePresenter && (
          <AIComponents excalidrawAPI={excalidrawAPI} />
        )}

        {!framePresenter && <TTDDialogTrigger />}
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

        {!framePresenter && (
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
                : isPresentationCanvasActive
                ? "Presentation"
                : activeCanvas?.title || "Canvas"
            }
            presentationId={activePresentation?.id || null}
            isCollaborating={isCollaborating}
            comments={comments}
            presentationElements={presentationElements}
            presentationAppState={presentationAppState}
            presentationFiles={presentationFiles}
            onPresentationSlideFocus={focusPresentationSlide}
            onPresentationStart={startFramePresentation}
            onPresentationLayoutChange={arrangePresentationFrames}
            onPresentationTemplateInsert={insertPresentationTemplate}
            onPresentationResourceInsert={insertPresentationResource}
            onPresentationSlideRename={renamePresentationSlide}
            onPresentationSlideDelete={deletePresentationSlide}
            onPresentationSlideReorder={reorderPresentationSlide}
            presentationAnimationMetadata={presentationAnimationMetadata}
            onPresentationBuildAdd={addPresentationBuild}
            onPresentationBuildDelete={deletePresentationBuild}
            onPresentationSlideTransitionChange={setPresentationSlideTransition}
            onSignIn={() => void drawsyAuth.signIn().catch(() => undefined)}
            onStartPlacement={
              isPresentationCanvasActive || kanbanOpen
                ? () => undefined
                : beginCommentPlacement
            }
            onGoToComment={goToComment}
            onCommentsOpenChange={setCommentsSidebarOpen}
          />
        )}
        {isPresentationCanvasActive && !framePresenter && (
          <div
            className="presentation-quick-dock"
            aria-label="Presentation quick actions"
          >
            <button
              type="button"
              className="presentation-quick-dock__button presentation-quick-dock__button--primary"
              onClick={startFramePresentation}
              disabled={presentationSlideCount === 0}
              title="Present"
              aria-label="Present"
            >
              {playerPlayIcon}
            </button>
            <button
              type="button"
              className="presentation-quick-dock__button"
              onClick={selectPresentationFrameTool}
              title="Frame tool"
              aria-label="Frame tool"
            >
              {frameToolIcon}
            </button>
            <div className="presentation-quick-dock__export">
              <button
                type="button"
                className="presentation-quick-dock__button"
                onClick={() =>
                  setPresentationExportMenuOpen((isOpen) => !isOpen)
                }
                title="Export"
                aria-expanded={presentationExportMenuOpen}
                aria-haspopup="menu"
              >
                {ExportIcon}
              </button>
              {presentationExportMenuOpen && (
                <div
                  className="presentation-quick-dock__menu"
                  role="menu"
                  aria-label="Export presentation"
                >
                  {[
                    ["PDF", "pdf"],
                    ["PNG ZIP", "pngZip"],
                    ["PPTX", "pptx"],
                    ["DOC", "docx"],
                  ].map(([label, format]) => (
                    <button
                      type="button"
                      key={label}
                      role="menuitem"
                      onClick={() => {
                        void exportPresentation(
                          format as PresentationExportFormat,
                        );
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="presentation-quick-dock__button"
              onClick={() => presentationImportInputRef.current?.click()}
              disabled={presentationImporting}
              title="Import"
              aria-label="Import"
            >
              {LoadIcon}
            </button>
            <input
              ref={presentationImportInputRef}
              type="file"
              accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) {
                  void importPresentationPptx(file);
                }
              }}
            />
          </div>
        )}
        {framePresenter && presentationFrameRect && (
          <div
            className="frame-presenter-mask"
            aria-hidden="true"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onPointerMove={(event) => {
              event.stopPropagation();
            }}
            onPointerUp={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onWheel={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <div
              style={{
                left: 0,
                top: 0,
                right: 0,
                height: Math.max(0, presentationFrameRect.top),
              }}
            />
            <div
              style={{
                left: 0,
                top: presentationFrameRect.top + presentationFrameRect.height,
                right: 0,
                bottom: 0,
              }}
            />
            <div
              style={{
                left: 0,
                top: presentationFrameRect.top,
                width: Math.max(0, presentationFrameRect.left),
                height: Math.max(0, presentationFrameRect.height),
              }}
            />
            <div
              style={{
                left: presentationFrameRect.left + presentationFrameRect.width,
                top: presentationFrameRect.top,
                right: 0,
                height: Math.max(0, presentationFrameRect.height),
              }}
            />
            {!presentationLaserActive && (
              <div
                className="frame-presenter-interaction-shield"
                style={{
                  left: presentationFrameRect.left,
                  top: presentationFrameRect.top,
                  width: Math.max(0, presentationFrameRect.width),
                  height: Math.max(0, presentationFrameRect.height),
                }}
              />
            )}
          </div>
        )}
        {framePresenter && (
          <div
            className="frame-presenter-transition"
            data-active={presentationTransitionActive}
            aria-hidden="true"
          />
        )}
        {framePresenter && (
          <div className="frame-presenter-controls" role="toolbar">
            <button
              className="frame-presenter-controls__button"
              type="button"
              onClick={togglePresentationTheme}
              aria-label="Toggle theme"
            >
              {editorTheme === THEME.DARK ? SunIcon : MoonIcon}
            </button>
            <button
              className="frame-presenter-controls__button"
              data-active={presentationLaserActive}
              type="button"
              onClick={activatePresentationLaser}
              aria-label="Laser pointer"
            >
              {laserPointerToolIcon}
            </button>
            <button
              className="frame-presenter-controls__button frame-presenter-controls__button--previous"
              type="button"
              onClick={() => void goToPresentationStep(-1)}
              disabled={
                framePresenter.index === 0 &&
                framePresenter.completedBuildCount === 0
              }
              aria-label="Previous build or slide"
            >
              {ArrowRightIcon}
            </button>
            <span className="frame-presenter-controls__count">
              {framePresenter.index + 1}/{framePresenter.frameIds.length} Slides
              {currentPresentationBuildCount > 0 &&
                ` · ${framePresenter.completedBuildCount}/${currentPresentationBuildCount} Builds`}
            </span>
            <button
              className="frame-presenter-controls__button"
              type="button"
              onClick={() => void goToPresentationStep(1)}
              disabled={
                framePresenter.index === framePresenter.frameIds.length - 1 &&
                framePresenter.completedBuildCount >=
                  currentPresentationBuildCount
              }
              aria-label="Next build or slide"
            >
              {ArrowRightIcon}
            </button>
            <button
              className="frame-presenter-controls__button frame-presenter-controls__button--exit"
              type="button"
              onClick={endFramePresentation}
              aria-label="End presentation"
            >
              {CloseIcon}
            </button>
          </div>
        )}
        {drawsyAuth.status === "authenticated" &&
          !isCollaborating &&
          !kanbanOpen &&
          !isPresentationCanvasActive && (
            <CommentPins
              comments={comments.comments}
              selectedId={comments.selectedId}
              onSelect={selectComment}
            />
          )}
        {drawsyAuth.status === "authenticated" &&
          !isCollaborating &&
          !kanbanOpen &&
          !isPresentationCanvasActive &&
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
