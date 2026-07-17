import { THEME } from "@excalidraw/excalidraw";
import { useEffect, useLayoutEffect, useState } from "react";

import type { Theme } from "@excalidraw/element/types";

import { STORAGE_KEYS } from "./app_constants";

const getDarkThemeMediaQuery = (): MediaQueryList | undefined =>
  window.matchMedia?.("(prefers-color-scheme: dark)");

const isAppTheme = (value: string | null): value is Theme | "system" =>
  value === THEME.LIGHT || value === THEME.DARK || value === "system";

const getStoredAppTheme = (): Theme | "system" => {
  const storedTheme = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_THEME);
  return isAppTheme(storedTheme) ? storedTheme : THEME.DARK;
};

const resolveEditorTheme = (appTheme: Theme | "system"): Theme =>
  appTheme === "system"
    ? getDarkThemeMediaQuery()?.matches
      ? THEME.DARK
      : THEME.LIGHT
    : appTheme;

export const useHandleAppTheme = () => {
  const [appTheme, setAppTheme] = useState<Theme | "system">(getStoredAppTheme);
  const [editorTheme, setEditorTheme] = useState<Theme>(() =>
    resolveEditorTheme(getStoredAppTheme()),
  );

  useEffect(() => {
    const mediaQuery = getDarkThemeMediaQuery();

    const handleChange = (e: MediaQueryListEvent) => {
      setEditorTheme(e.matches ? THEME.DARK : THEME.LIGHT);
    };

    if (appTheme === "system") {
      mediaQuery?.addEventListener("change", handleChange);
    }

    return () => {
      mediaQuery?.removeEventListener("change", handleChange);
    };
  }, [appTheme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.LOCAL_STORAGE_THEME) {
        setAppTheme(isAppTheme(event.newValue) ? event.newValue : THEME.DARK);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useLayoutEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_THEME, appTheme);

    setEditorTheme(resolveEditorTheme(appTheme));
  }, [appTheme]);

  return { editorTheme, appTheme, setAppTheme };
};
