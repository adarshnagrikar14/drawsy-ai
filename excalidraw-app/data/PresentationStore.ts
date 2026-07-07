import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";
import { debounce } from "@excalidraw/common";
import { createStore, get, set } from "idb-keyval";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import { SAVE_TO_LOCAL_STORAGE_TIMEOUT, STORAGE_KEYS } from "../app_constants";

import type { CanvasScene } from "./WorkspaceStore";

const presentationStore = createStore(
  "drawsy-presentation-db",
  "presentation-store",
);

const PRESENTATION_DOCUMENT_KEY = "presentation-document";

type PresentationDocument = {
  schemaVersion: 1;
  title: "Presentation";
  scene: {
    elements: readonly ExcalidrawElement[];
    appState: Partial<AppState>;
    files: BinaryFiles;
  };
  updatedAt: number;
};

const normalizeScene = (scene: CanvasScene): PresentationDocument["scene"] => ({
  elements: scene.elements || [],
  appState: {
    ...clearAppStateForLocalStorage(scene.appState || {}),
    name: "Presentation",
  },
  files: scene.files || {},
});

const persistScene = async (scene: CanvasScene) => {
  const document: PresentationDocument = {
    schemaVersion: 1,
    title: "Presentation",
    scene: normalizeScene(scene),
    updatedAt: Date.now(),
  };
  await set(PRESENTATION_DOCUMENT_KEY, document, presentationStore);
};

export class PresentationStore {
  private static saveSceneDebounced = debounce(
    (scene: CanvasScene) => persistScene(scene),
    SAVE_TO_LOCAL_STORAGE_TIMEOUT,
  );

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

  static async loadScene(): Promise<CanvasScene | null> {
    const document = await get<PresentationDocument>(
      PRESENTATION_DOCUMENT_KEY,
      presentationStore,
    );
    if (!document || document.schemaVersion !== 1) {
      return null;
    }

    return {
      elements: document.scene.elements,
      appState: {
        ...document.scene.appState,
        name: "Presentation",
      },
      files: document.scene.files || {},
    };
  }

  static saveScene(scene: CanvasScene) {
    this.saveSceneDebounced(scene);
  }

  static async flushSave(scene?: CanvasScene | null) {
    if (scene) {
      await persistScene(scene);
      return;
    }
    await this.saveSceneDebounced.flush();
  }
}
