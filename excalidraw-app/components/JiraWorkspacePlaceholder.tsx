import { useState } from "react";

import { THEME, applyDarkModeFilter } from "@excalidraw/excalidraw";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";

const JiraMark = () => (
  <svg viewBox="0 0 1600 1600" aria-hidden="true">
    <path d="M766 170h685c35 0 64 29 64 64v682c-172 0-312-139-312-310V482h-125c-172 0-312-139-312-312ZM426 513h685c35 0 64 29 64 64v682c-172 0-312-139-312-310V825H738c-172 0-312-139-312-312ZM85 856h685c35 0 64 29 64 64v682c-172 0-312-139-312-310v-124H397c-172 0-312-139-312-312Z" />
  </svg>
);

const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12h13M14 7l5 5-5 5" />
  </svg>
);

const capabilities = ["Issues", "Boards", "Sprints", "Queues"];

export const JiraWorkspacePlaceholder = ({
  onConnect,
}: {
  onConnect: () => void | Promise<void>;
}) => {
  const appState = useUIAppState() || getDefaultAppState();
  const [connecting, setConnecting] = useState(false);

  const connect = () => {
    if (connecting) {
      return;
    }
    setConnecting(true);
    try {
      const result = onConnect();
      if (result instanceof Promise) {
        void result.then(
          () => setConnecting(false),
          () => setConnecting(false),
        );
        return;
      }
    } catch (error) {
      setConnecting(false);
      throw error;
    }
    setConnecting(false);
  };

  return (
    <section
      className="jira-workspace-surface"
      aria-label="Jira Workspace"
      style={{
        backgroundColor: applyDarkModeFilter(
          appState.viewBackgroundColor,
          appState.theme === THEME.DARK,
        ),
      }}
    >
      <div className="jira-ambient jira-ambient--table" aria-hidden="true">
        <div>
          <strong>Issue</strong>
          <strong>Status</strong>
        </div>
        <div>
          <span>DSY-82</span>
          <span>In review</span>
        </div>
        <div>
          <span>DSY-91</span>
          <span>To do</span>
        </div>
      </div>

      <div className="jira-ambient jira-ambient--detail" aria-hidden="true">
        <span>DSY-204</span>
        <strong>Refine contributor flow</strong>
        <small>Medium · Assigned</small>
      </div>

      <div className="jira-ambient jira-ambient--sprint" aria-hidden="true">
        <span>Sprint 08</span>
        <i>
          <b />
        </i>
        <small>7 / 12</small>
      </div>

      <div className="jira-connect-console">
        <header>
          <span className="jira-connect-console__eyebrow">
            Contributor workspace
          </span>
          <h2>Bring Jira into Drawsy</h2>
          <p>One place to check work, make updates, and keep moving.</p>
        </header>

        <div className="jira-connect-bridge">
          <div className="jira-connect-endpoint jira-connect-endpoint--drawsy">
            <span>
              <img src="/drawsy-logo-monochrome.svg" alt="" />
            </span>
            <strong>Drawsy</strong>
          </div>

          <div className="jira-connect-track">
            <i />
            <button
              type="button"
              className={`jira-connect-action ${
                connecting ? "is-loading" : ""
              }`}
              disabled={connecting}
              aria-busy={connecting}
              onClick={connect}
            >
              <span>{connecting ? "Connecting…" : "Connect Jira"}</span>
              {connecting ? <i className="jira-spinner" /> : <Arrow />}
            </button>
            <i />
          </div>

          <div className="jira-connect-endpoint jira-connect-endpoint--jira">
            <span>
              <JiraMark />
            </span>
            <strong>Jira</strong>
          </div>
        </div>

        <div className="jira-connect-capabilities" aria-label="Jira features">
          {capabilities.map((capability, index) => (
            <span key={capability}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              {capability}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};
