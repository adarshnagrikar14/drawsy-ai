import {
  loginIcon,
  MagicIcon,
  WelcomeScreenMenuArrow,
} from "@excalidraw/excalidraw/components/icons";
import { POINTER_EVENTS } from "@excalidraw/common";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import { getShortcutKey } from "@excalidraw/excalidraw/shortcut";
import React from "react";

import { isExcalidrawPlusSignedUser } from "../app_constants";

export const AppWelcomeScreen: React.FC<{
  onCollabDialogOpen: () => any;
  isCollabEnabled: boolean;
  isPresentationMode?: boolean;
  onOpenPresentationPanel?: () => void;
  authStatus: "loading" | "anonymous" | "authenticated";
  onDrawsyAISelect: () => void;
  onSignIn: () => void;
}> = React.memo((props) => {
  const { t } = useI18n();
  let headingContent;

  if (props.isPresentationMode) {
    return (
      <WelcomeScreen>
        <div className="presentation-welcome-screen excalifont">
          <div
            className="presentation-welcome-screen__sketch"
            aria-hidden="true"
          >
            <div className="presentation-welcome-screen__slide presentation-welcome-screen__slide--one">
              <span />
              <span />
            </div>
            <svg
              viewBox="0 0 280 120"
              fill="none"
              className="presentation-welcome-screen__path"
            >
              <path
                d="M12 82c45-54 94-68 145-41 38 20 67 23 108-12"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="7 13"
              />
              <path
                d="M265 29c-7 2-14 1-21-3"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M265 29c-5 6-8 13-8 21"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <div className="presentation-welcome-screen__slide presentation-welcome-screen__slide--two">
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="presentation-welcome-screen__panel">
            <div className="presentation-welcome-screen__title">
              Shape the story on canvas
            </div>
            <div className="presentation-welcome-screen__body">
              Sketch each idea as a frame, connect the moments, then turn the
              canvas into a guided presentation.
            </div>
            <div className="presentation-welcome-screen__note">
              Start with a frame. Add title, visuals, and the next beat.
            </div>
            <button
              type="button"
              className="presentation-welcome-screen__start"
              onClick={() => props.onOpenPresentationPanel?.()}
            >
              <span className="presentation-welcome-screen__start-icon">
                |&gt;
              </span>
              <span>Start Presenting</span>
            </button>
          </div>
          <div className="presentation-welcome-screen__hint">
            <span>Presentation panel</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 74 82"
              fill="none"
              className="presentation-welcome-screen__hint-arrow"
            >
              <path
                d="M37 79c-7-24-6-50 0-69"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path
                d="M37 10c-5 7-11 11-20 12"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path
                d="M37 10c5 7 11 11 20 12"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </WelcomeScreen>
    );
  }

  if (isExcalidrawPlusSignedUser) {
    headingContent = t("welcomeScreen.app.center_heading_plus")
      .split(/(Drawsy\+)/)
      .map((bit, idx) => {
        if (bit === "Drawsy+") {
          return (
            <a
              style={{ pointerEvents: POINTER_EVENTS.inheritFromUI }}
              href={`${
                import.meta.env.VITE_APP_PLUS_APP
              }?utm_source=excalidraw&utm_medium=app&utm_content=welcomeScreenSignedInUser`}
              key={idx}
            >
              Drawsy+
            </a>
          );
        }
        return bit;
      });
  } else {
    headingContent = (
      <>
        {t("welcomeScreen.app.center_heading")}
        <br />
        {t("welcomeScreen.app.center_heading_line2")}
        <br />
        {t("welcomeScreen.app.center_heading_line3")}
      </>
    );
  }

  return (
    <WelcomeScreen>
      <WelcomeScreen.Hints.MenuHint>
        <div className="drawsy-workspaces-welcome-hint">
          <div className="drawsy-workspaces-welcome-hint__title">
            Explore more than a canvas.
          </div>
          <div className="drawsy-workspaces-welcome-hint__body">
            Drawsy brings you more productivity with:
          </div>
          <div className="drawsy-workspaces-welcome-hint__list">
            <span>Presentation</span>
            <span>Tracker</span>
            <span>Projects</span>
            <span>Connectors</span>
          </div>
        </div>
      </WelcomeScreen.Hints.MenuHint>
      <WelcomeScreen.Hints.ToolbarHint />
      <WelcomeScreen.Hints.HelpHint />
      <WelcomeScreen.Center>
        <WelcomeScreen.Center.Logo />
        <WelcomeScreen.Center.Heading>
          {headingContent}
        </WelcomeScreen.Center.Heading>
        <WelcomeScreen.Center.Menu>
          <WelcomeScreen.Center.MenuItemLoadScene />
          <WelcomeScreen.Center.MenuItemHelp />
          {props.isCollabEnabled && (
            <WelcomeScreen.Center.MenuItemLiveCollaborationTrigger
              onSelect={() => props.onCollabDialogOpen()}
            />
          )}
          {props.authStatus === "authenticated" && (
            <WelcomeScreen.Center.MenuItem
              onSelect={props.onDrawsyAISelect}
              shortcut={getShortcutKey("CtrlOrCmd+K")}
              icon={MagicIcon}
            >
              Drawsy AI
            </WelcomeScreen.Center.MenuItem>
          )}
          {props.authStatus === "anonymous" && (
            <WelcomeScreen.Center.MenuItem
              onSelect={props.onSignIn}
              shortcut={null}
              icon={loginIcon}
            >
              Sign up
            </WelcomeScreen.Center.MenuItem>
          )}
        </WelcomeScreen.Center.Menu>
        {props.authStatus === "authenticated" && (
          <div
            className="excalifont welcome-screen-decor welcome-screen-decor-hint drawsy-ai-welcome-hint"
            aria-hidden="true"
          >
            <div className="welcome-screen-decor-hint__label">
              Ask Drawsy AI to shape the canvas.
            </div>
            {WelcomeScreenMenuArrow}
          </div>
        )}
      </WelcomeScreen.Center>
    </WelcomeScreen>
  );
});
