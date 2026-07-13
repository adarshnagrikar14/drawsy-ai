import { THEME, applyDarkModeFilter } from "@excalidraw/excalidraw";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import { useEffect, useState } from "react";

import "./ConnectorsWorkspace.scss";

import type {
  ConnectorCapability,
  ConnectorProvider,
  ConnectorsApi,
  ConnectorsOverview,
} from "../data/ConnectorsApi";

const ConnectorLogo = ({ id }: { id: string }) => {
  if (id === "mail") {
    return (
      <svg viewBox="0 0 32 32">
        <rect x="4" y="7" width="24" height="18" rx="3" />
        <path d="m6 10 10 8 10-8" />
      </svg>
    );
  }
  if (id === "calendar") {
    return (
      <svg viewBox="0 0 32 32">
        <rect x="5" y="6" width="22" height="21" rx="3" />
        <path d="M5 12h22M10 4v5M22 4v5" />
        <path d="M11 17h3M18 17h3M11 22h3M18 22h3" />
      </svg>
    );
  }
  if (id === "notion") {
    return (
      <svg viewBox="0 0 32 32">
        <path d="M7 6.5 22 5l3 2.5v18L10 27l-3-2.5Z" />
        <path d="M10 10v13M12 10l8 12V9M18 9h4" />
      </svg>
    );
  }
  if (id === "drive") {
    return (
      <svg viewBox="0 0 32 32">
        <path d="M13 5h6l9 15-3 6h-6L10 11Z" />
        <path d="M10 11 4 21l3 5h18M4 21h18" />
      </svg>
    );
  }
  if (id === "slack") {
    return (
      <svg viewBox="0 0 32 32">
        <path d="M12 5v22M20 5v22M5 12h22M5 20h22" />
        <circle cx="12" cy="7" r="2" />
        <circle cx="25" cy="12" r="2" />
        <circle cx="20" cy="25" r="2" />
        <circle cx="7" cy="20" r="2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32">
      <path d="M9 26c-1-3-1-5 0-7-3-1-4-4-3-7 1 0 3 0 4 1 3-2 9-2 12 0 1-1 3-1 4-1 1 3 0 6-3 7 1 3 1 5 0 7" />
      <path d="M12 26v-4c-3 1-5 0-6-2M20 26v-5" />
    </svg>
  );
};

const connectors = [
  {
    id: "mail",
    capability: "mail",
    name: "Mail",
    detail: "Search messages and bring threads into context.",
    tone: "coral",
  },
  {
    id: "calendar",
    capability: "calendar",
    name: "Calendar",
    detail: "Read schedules and turn events into work.",
    tone: "blue",
  },
  {
    id: "notion",
    capability: "notion",
    name: "Notion",
    detail: "Reference pages, notes, and databases.",
    tone: "ink",
  },
  {
    id: "drive",
    capability: "drive",
    name: "Drive",
    detail: "Find files and attach source material.",
    tone: "green",
  },
  {
    id: "slack",
    capability: "slack",
    name: "Slack",
    detail: "Pull decisions and updates from channels.",
    tone: "violet",
  },
  {
    id: "github",
    capability: "github",
    name: "GitHub",
    detail: "Connect code, issues, and pull requests.",
    tone: "ink",
  },
] as const;

type ConnectorsWorkspaceProps = {
  api: ConnectorsApi | null;
  onSignIn: () => Promise<void>;
};

const providerForCapability = (
  overview: ConnectorsOverview | null,
  capability: ConnectorCapability | undefined,
) =>
  capability
    ? overview?.providers.find((provider) =>
        provider.capabilities.includes(capability),
      )
    : undefined;

export const ConnectorsWorkspace = ({
  api,
  onSignIn,
}: ConnectorsWorkspaceProps) => {
  const appState = useUIAppState() || getDefaultAppState();
  const [overview, setOverview] = useState<ConnectorsOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api) {
      setOverview(null);
      setLoadingOverview(false);
      return;
    }
    let cancelled = false;
    setLoadingOverview(true);
    setError(null);
    void api
      .getOverview()
      .then((nextOverview) => {
        if (!cancelled) {
          setOverview(nextOverview);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Connections could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingOverview(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const refresh = async () => {
    if (!api) {
      return;
    }
    setLoadingOverview(true);
    setError(null);
    try {
      setOverview(await api.getOverview());
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Connections could not be loaded.",
      );
    } finally {
      setLoadingOverview(false);
    }
  };

  const connect = async (provider: ConnectorProvider) => {
    if (!api || !provider.configured) {
      return;
    }
    setActiveProviderId(provider.id);
    setError(null);
    try {
      setOverview(await api.connect(provider.id));
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : `${provider.name} could not be connected.`,
      );
    } finally {
      setActiveProviderId(null);
    }
  };

  const disconnect = async (provider: ConnectorProvider) => {
    if (!api || !overview) {
      return;
    }
    const connections = overview.connections.filter(
      (connection) => connection.providerId === provider.id,
    );
    setActiveProviderId(provider.id);
    setError(null);
    try {
      await Promise.all(
        connections.map((connection) => api.disconnect(connection.id)),
      );
      setOverview(await api.getOverview());
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : `${provider.name} could not be disconnected.`,
      );
    } finally {
      setActiveProviderId(null);
    }
  };

  const signIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await onSignIn();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Sign-in could not be completed.",
      );
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <section
      className="connectors-workspace"
      aria-label="Connectors"
      style={{
        backgroundColor: applyDarkModeFilter(
          appState.viewBackgroundColor,
          appState.theme === THEME.DARK,
        ),
      }}
    >
      <header className="connectors-heading">
        <span className="connectors-kicker">Connected context</span>
        <h2>Give your canvas the right context.</h2>
        <p>
          Choose where Drawsy can look when you ask it to research, plan, or
          create.
        </p>
      </header>

      {!api && (
        <div className="connectors-feedback">
          <span>{error || "Sign in to manage your connections."}</span>
          <button
            type="button"
            onClick={() => void signIn()}
            disabled={signingIn}
          >
            {signingIn ? "Signing in…" : "Sign in"}
          </button>
        </div>
      )}
      {api && error && (
        <div className="connectors-feedback" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loadingOverview}
          >
            Retry
          </button>
        </div>
      )}

      <div className="connectors-board">
        <svg
          className="connectors-paths"
          viewBox="0 0 1000 420"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M500 210C420 210 390 70 300 70M500 210C580 210 610 70 700 70M500 210H300M500 210H700M500 210C420 210 390 350 300 350M500 210C580 210 610 350 700 350" />
        </svg>

        {connectors.map((connector) => {
          const capability =
            "capability" in connector ? connector.capability : undefined;
          const provider = providerForCapability(overview, capability);
          const connections = provider
            ? overview?.connections.filter(
                (connection) => connection.providerId === provider.id,
              ) || []
            : [];
          const connected = connections.length > 0;
          const account = connections[0];
          const detail = connected
            ? `${account.accountEmail || account.accountName}${
                connections.length > 1 ? ` +${connections.length - 1} more` : ""
              }`
            : connector.detail;
          const working = activeProviderId === provider?.id;

          return (
            <article
              className={`connector-card connector-card--${connector.tone} ${
                connected ? "is-connected" : ""
              }`}
              key={connector.id}
            >
              <span className="connector-card__mark" aria-hidden="true">
                <ConnectorLogo id={connector.id} />
              </span>
              <div
                className={`connector-card__copy ${
                  connected ? "is-connected" : ""
                }`}
              >
                <strong className={connected ? "is-connected" : undefined}>
                  {connector.name}
                </strong>
                <small>{detail}</small>
              </div>
              {provider?.configured && (
                <div className="connector-card__controls">
                  <button
                    className={
                      connected
                        ? "connector-card__disconnect"
                        : "connector-card__connect"
                    }
                    type="button"
                    disabled={working}
                    onClick={() =>
                      void (connected
                        ? disconnect(provider)
                        : connect(provider))
                    }
                    aria-label={`${connected ? "Disconnect" : "Connect"} ${
                      provider.name
                    } for ${connector.name}`}
                  >
                    {working
                      ? connected
                        ? "Disconnecting…"
                        : "Connecting…"
                      : connected
                      ? "Disconnect"
                      : "Connect"}
                  </button>
                </div>
              )}
              {provider && !provider.configured && (
                <span className="connector-card__state connector-card__state--unavailable">
                  Not available
                </span>
              )}
              {api && loadingOverview && !overview && capability && (
                <span className="connector-card__checking">Checking…</span>
              )}
            </article>
          );
        })}

        <div className="connectors-hub" aria-label="Drawsy">
          <span>
            <img src="/drawsy-logo-monochrome.svg" alt="" />
          </span>
          <strong>Drawsy</strong>
        </div>
      </div>

      <footer className="connectors-note">
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M10 14v-3a6 6 0 0 1 12 0v3M8 14h16v13H8z" />
          <circle cx="16" cy="20" r="1.5" />
        </svg>
        <p>
          Each source connects separately, so you choose exactly what context
          enters this workspace.
        </p>
      </footer>
    </section>
  );
};
