import { DefaultSidebar, Sidebar, THEME } from "@excalidraw/excalidraw";
import {
  messageCircleIcon,
  presentationIcon,
} from "@excalidraw/excalidraw/components/icons";
import { LinkButton } from "@excalidraw/excalidraw/components/LinkButton";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import { useEffect } from "react";

import { CommentsSidebar } from "../comments/CommentsSidebar";

import "./AppSidebar.scss";

import type { CanvasComment } from "../comments/types";
import type { CanvasCommentsController } from "../comments/useCanvasComments";

export const AppSidebar = ({
  authStatus,
  displayName,
  canvasTitle,
  isCollaborating,
  comments,
  onSignIn,
  onStartPlacement,
  onGoToComment,
  onCommentsOpenChange,
}: {
  authStatus: "loading" | "anonymous" | "authenticated";
  displayName: string;
  canvasTitle: string;
  isCollaborating: boolean;
  comments: CanvasCommentsController;
  onSignIn: () => void;
  onStartPlacement: () => void;
  onGoToComment: (comment: CanvasComment) => void;
  onCommentsOpenChange: (open: boolean) => void;
}) => {
  const { theme, openSidebar } = useUIAppState();

  useEffect(() => {
    onCommentsOpenChange(openSidebar?.tab === "comments");
  }, [onCommentsOpenChange, openSidebar?.tab]);

  return (
    <DefaultSidebar>
      <DefaultSidebar.TabTriggers>
        <Sidebar.TabTrigger tab="comments">
          {messageCircleIcon}
        </Sidebar.TabTrigger>
        <Sidebar.TabTrigger tab="presentation">
          {presentationIcon}
        </Sidebar.TabTrigger>
      </DefaultSidebar.TabTriggers>
      <Sidebar.Tab tab="comments">
        <CommentsSidebar
          authStatus={authStatus}
          displayName={displayName}
          canvasTitle={canvasTitle}
          isCollaborating={isCollaborating}
          placeholderImage={`/oss_promo_comments_${
            theme === THEME.DARK ? "dark" : "light"
          }.jpg`}
          controller={comments}
          onSignIn={onSignIn}
          onStartPlacement={onStartPlacement}
          onGoToComment={onGoToComment}
        />
      </Sidebar.Tab>
      <Sidebar.Tab tab="presentation" className="px-3">
        <div className="app-sidebar-promo-container">
          <div
            className="app-sidebar-promo-image"
            style={{
              ["--image-source" as any]: `url(/oss_promo_presentations_${
                theme === THEME.DARK ? "dark" : "light"
              }.svg)`,
              backgroundSize: "60%",
              opacity: 0.4,
            }}
          />
          <div className="app-sidebar-promo-text">
            Create presentations with Drawsy+
          </div>
          <LinkButton
            href={`${
              import.meta.env.VITE_APP_PLUS_LP
            }/plus?utm_source=excalidraw&utm_medium=app&utm_content=presentations_promo#excalidraw-redirect`}
          >
            Sign up now
          </LinkButton>
        </div>
      </Sidebar.Tab>
    </DefaultSidebar>
  );
};
