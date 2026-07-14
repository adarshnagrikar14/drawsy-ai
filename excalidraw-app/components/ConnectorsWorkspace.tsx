import { THEME, applyDarkModeFilter } from "@excalidraw/excalidraw";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import { useEffect, useState } from "react";

import "./ConnectorsWorkspace.scss";
import { ConnectorLogo, connectorCatalog } from "./connectorCatalog";

import type {
  ConnectorCapability,
  ConnectorProvider,
  ConnectorsApi,
  ConnectorsOverview,
} from "../data/ConnectorsApi";

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

        {connectorCatalog.map((connector) => {
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
                <ConnectorLogo capability={connector.capability} />
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
                  {connected && account.manageUrl && (
                    <a
                      className="connector-card__manage"
                      href={account.manageUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Manage access
                    </a>
                  )}
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
