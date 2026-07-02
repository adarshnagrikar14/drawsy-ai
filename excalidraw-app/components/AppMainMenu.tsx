import {
  loginIcon,
  ExcalLogo,
  eyeIcon,
} from "@excalidraw/excalidraw/components/icons";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React from "react";

import { isDevEnv } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { LanguageList } from "../app-language/LanguageList";

import { saveDebugState } from "./DebugCanvas";

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  refresh: () => void;
  addMenu: React.ReactNode;
  header: React.ReactNode;
  auth: {
    status: "loading" | "anonymous" | "authenticated";
    displayName: string | null;
    isBusy: boolean;
    syncStatus: "local" | "syncing" | "synced" | "error";
    onSignIn: () => void;
    onSignOut: () => void;
  };
}> = React.memo((props) => {
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
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />
      <MainMenu.ItemLink
        icon={ExcalLogo}
        href={`${
          import.meta.env.VITE_APP_PLUS_LP
        }/plus?utm_source=excalidraw&utm_medium=app&utm_content=hamburger`}
        className=""
      >
        Drawsy+
      </MainMenu.ItemLink>
      <MainMenu.DefaultItems.Socials />
      <MainMenu.Item
        icon={loginIcon}
        className="highlighted"
        disabled={props.auth.status === "loading" || props.auth.isBusy}
        onSelect={
          props.auth.status === "authenticated"
            ? props.auth.onSignOut
            : props.auth.onSignIn
        }
      >
        {props.auth.isBusy
          ? "Please wait..."
          : props.auth.status === "authenticated"
          ? `Sign out${
              props.auth.displayName ? ` · ${props.auth.displayName}` : ""
            }`
          : "Continue with Google"}
      </MainMenu.Item>
      {props.auth.status === "authenticated" && (
        <MainMenu.ItemCustom>
          <div className="drawsy-sync-status" role="status">
            <span data-status={props.auth.syncStatus} />
            {props.auth.syncStatus === "syncing"
              ? "Syncing workspace"
              : props.auth.syncStatus === "error"
              ? "Sync needs attention"
              : "Workspace synced"}
          </div>
        </MainMenu.ItemCustom>
      )}
      {isDevEnv() && (
        <MainMenu.Item
          icon={eyeIcon}
          onSelect={() => {
            if (window.visualDebug) {
              delete window.visualDebug;
              saveDebugState({ enabled: false });
            } else {
              window.visualDebug = { data: [] };
              saveDebugState({ enabled: true });
            }
            props?.refresh();
          }}
        >
          Visual Debug
        </MainMenu.Item>
      )}
      <MainMenu.Separator />
      <MainMenu.DefaultItems.Preferences />
      <MainMenu.DefaultItems.ToggleTheme allowSystemTheme theme={props.theme} />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});
