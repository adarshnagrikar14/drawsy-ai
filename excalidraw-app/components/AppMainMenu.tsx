import {
  DeviceDesktopIcon,
  MoonIcon,
  RetryIcon,
  SunIcon,
} from "@excalidraw/excalidraw/components/icons";
import { languages } from "@excalidraw/excalidraw/i18n";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React from "react";

import { THEME } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

const GoogleLogo = (
  <svg aria-hidden="true" viewBox="0 0 18 18" className="drawsy-google-logo">
    <path
      fill="#4285F4"
      d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.703-1.568 2.684-3.879 2.684-6.614Z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.468-.806 5.956-2.181l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z"
    />
    <path
      fill="#FBBC05"
      d="M3.963 10.706A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.281-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.332Z"
    />
    <path
      fill="#EA4335"
      d="M9 3.58c1.322 0 2.507.454 3.441 1.346l2.581-2.582C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z"
    />
  </svg>
);

const LanguageIcon = (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m5 8 6 6" />
    <path d="m4 14 6-6 2-3" />
    <path d="M2 5h12" />
    <path d="M7 2h1" />
    <path d="m22 22-5-10-5 10" />
    <path d="M14 18h6" />
  </svg>
);

const CanvasStyleIcon = (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
    <path d="M12 22a10 10 0 1 0-10-10 4 4 0 0 0 4 4h1.65a1.35 1.35 0 0 1 1.14 2.07l-.27.41A2.25 2.25 0 0 0 10.42 22Z" />
  </svg>
);

const themeLabel = (theme: Theme | "system") =>
  theme === THEME.LIGHT ? "Light" : theme === THEME.DARK ? "Dark" : "System";

const syncLabel = (
  status: "local" | "pending" | "syncing" | "synced" | "error",
) => {
  switch (status) {
    case "syncing":
      return "Syncing workspace";
    case "synced":
      return "Sync now. Workspace is up to date";
    case "pending":
      return "Changes saved locally. Sync now";
    case "error":
      return "Retry workspace sync";
    default:
      return "Sync now. Workspace is saved locally";
  }
};

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  onThemeChange: (theme: Theme | "system") => void;
  language: string;
  onLanguageChange: (language: string) => void;
  addMenu: React.ReactNode;
  header: React.ReactNode;
  auth: {
    status: "loading" | "anonymous" | "authenticated";
    displayName: string | null;
    isBusy: boolean;
    syncStatus: "local" | "pending" | "syncing" | "synced" | "error";
    onSignIn: () => void;
    onSync: () => void;
  };
}> = React.memo((props) => {
  const selectedLanguage =
    languages.find((language) => language.code === props.language)?.label ||
    props.language;
  const appearanceIcon =
    props.theme === THEME.LIGHT
      ? SunIcon
      : props.theme === THEME.DARK
      ? MoonIcon
      : DeviceDesktopIcon;

  return (
    <MainMenu addMenu={props.addMenu} header={props.header}>
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.SaveAsImage />
      {props.isCollabEnabled && (
        <MainMenu.DefaultItems.LiveCollaborationTrigger
          isCollaborating={props.isCollaborating}
          onSelect={() => props.onCollabDialogOpen()}
        />
      )}

      <MainMenu.Separator />
      <MainMenu.DefaultItems.CommandPalette />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />

      <MainMenu.Separator />
      <MainMenu.DefaultItems.Preferences />
      <MainMenu.Sub>
        <MainMenu.Sub.Trigger
          icon={appearanceIcon}
          shortcut={themeLabel(props.theme)}
        >
          Appearance
        </MainMenu.Sub.Trigger>
        <MainMenu.Sub.Content className="drawsy-settings-submenu">
          <MainMenu.Item
            icon={SunIcon}
            selected={props.theme === THEME.LIGHT}
            onSelect={() => props.onThemeChange(THEME.LIGHT)}
          >
            Light
          </MainMenu.Item>
          <MainMenu.Item
            icon={MoonIcon}
            selected={props.theme === THEME.DARK}
            onSelect={() => props.onThemeChange(THEME.DARK)}
          >
            Dark
          </MainMenu.Item>
          <MainMenu.Item
            icon={DeviceDesktopIcon}
            selected={props.theme === "system"}
            onSelect={() => props.onThemeChange("system")}
          >
            System
          </MainMenu.Item>
        </MainMenu.Sub.Content>
      </MainMenu.Sub>
      <MainMenu.Sub>
        <MainMenu.Sub.Trigger icon={LanguageIcon} shortcut={selectedLanguage}>
          Language
        </MainMenu.Sub.Trigger>
        <MainMenu.Sub.Content className="drawsy-language-submenu">
          {languages.map((language) => (
            <MainMenu.Item
              key={language.code}
              selected={language.code === props.language}
              onSelect={() => props.onLanguageChange(language.code)}
            >
              {language.label}
            </MainMenu.Item>
          ))}
        </MainMenu.Sub.Content>
      </MainMenu.Sub>
      <MainMenu.Sub>
        <MainMenu.Sub.Trigger icon={CanvasStyleIcon}>
          Canvas style
        </MainMenu.Sub.Trigger>
        <MainMenu.Sub.Content className="drawsy-canvas-style-submenu">
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu.Sub.Content>
      </MainMenu.Sub>

      <MainMenu.Separator />
      <MainMenu.ItemCustom className="drawsy-plus-menu-item">
        <span className="dropdown-menu-item__icon">
          <img
            className="drawsy-plus-menu-mark"
            src="/drawsy-logo.svg"
            alt=""
          />
        </span>
        <span className="drawsy-plus-menu-copy">
          <span className="drawsy-plus-menu-label">
            <strong>Drawsy+</strong>
            <small>Stay tuned, Plus is coming!</small>
          </span>
        </span>
      </MainMenu.ItemCustom>
      <MainMenu.Separator />
      {props.auth.status === "authenticated" ? (
        <MainMenu.ItemCustom className="drawsy-account-item">
          <div className="drawsy-account-row">
            {GoogleLogo}
            <span className="drawsy-account-name">
              {props.auth.displayName || "Google account"}
            </span>
            <button
              type="button"
              className="drawsy-account-sync"
              data-status={props.auth.syncStatus}
              aria-label={syncLabel(props.auth.syncStatus)}
              title={syncLabel(props.auth.syncStatus)}
              disabled={props.auth.syncStatus === "syncing"}
              onClick={props.auth.onSync}
            >
              {RetryIcon}
            </button>
          </div>
        </MainMenu.ItemCustom>
      ) : (
        <MainMenu.Item
          icon={GoogleLogo}
          className="drawsy-account-sign-in"
          disabled={props.auth.status === "loading" || props.auth.isBusy}
          onSelect={props.auth.onSignIn}
        >
          {props.auth.isBusy ? "Please wait..." : "Continue with Google"}
        </MainMenu.Item>
      )}
    </MainMenu>
  );
});
