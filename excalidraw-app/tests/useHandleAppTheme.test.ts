import { act, renderHook } from "@testing-library/react";

import { THEME } from "@excalidraw/common";

import { STORAGE_KEYS } from "../app_constants";
import { useHandleAppTheme } from "../useHandleAppTheme";

describe("useHandleAppTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts new users in dark mode without a light first render", () => {
    const { result } = renderHook(() => useHandleAppTheme());

    expect(result.current.appTheme).toBe(THEME.DARK);
    expect(result.current.editorTheme).toBe(THEME.DARK);
    expect(localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_THEME)).toBe(
      THEME.DARK,
    );
  });

  it("restores an explicit preference and synchronizes changes from another tab", () => {
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_THEME, THEME.LIGHT);
    const { result } = renderHook(() => useHandleAppTheme());

    expect(result.current.appTheme).toBe(THEME.LIGHT);
    expect(result.current.editorTheme).toBe(THEME.LIGHT);

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_KEYS.LOCAL_STORAGE_THEME,
          newValue: THEME.DARK,
        }),
      );
    });

    expect(result.current.appTheme).toBe(THEME.DARK);
    expect(result.current.editorTheme).toBe(THEME.DARK);
  });
});
