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
  const [awsSetupOpen, setAwsSetupOpen] = useState(false);
  const [awsAccountId, setAwsAccountId] = useState("");
  const [awsSetupWaiting, setAwsSetupWaiting] = useState(false);

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

  const beginConnect = (provider: ConnectorProvider) => {
    if (provider.id === "aws") {
      setError(null);
      setAwsSetupOpen(true);
      return;
    }
    void connect(provider);
  };

  const connectAws = async () => {
    if (!api || !/^\d{12}$/.test(awsAccountId)) {
      return;
    }
    setActiveProviderId("aws");
    setAwsSetupWaiting(true);
    setError(null);
    try {
      setOverview(await api.connectAws(awsAccountId));
      setAwsSetupOpen(false);
      setAwsAccountId("");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "AWS could not be connected.",
      );
    } finally {
      setAwsSetupWaiting(false);
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

      {awsSetupOpen && (
        <div className="aws-setup-backdrop" role="presentation">
          <form
            className="aws-setup-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="aws-setup-title"
            onSubmit={(event) => {
              event.preventDefault();
              void connectAws();
            }}
          >
            <button
              className="aws-setup-sheet__close"
              type="button"
              aria-label="Close AWS setup"
              onClick={() => setAwsSetupOpen(false)}
            >
              ×
            </button>
            <span className="aws-setup-sheet__mark" aria-hidden="true">
              <ConnectorLogo capability="aws" />
            </span>
            <div className="aws-setup-sheet__copy">
              <h3 id="aws-setup-title">
                {awsSetupWaiting ? "Waiting for AWS" : "Connect AWS"}
              </h3>
              <p>
                {awsSetupWaiting
                  ? "Finish creating the read-only stack in the AWS tab. Drawsy will verify it here."
                  : "Enter the account you want Drawsy to inspect. You’ll review the read-only role in AWS."}
              </p>
            </div>
            {!awsSetupWaiting && (
              <label className="aws-setup-sheet__field">
                <span>AWS account ID</span>
                <input
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={12}
                  placeholder="123456789012"
                  value={awsAccountId}
                  onChange={(event) =>
                    setAwsAccountId(event.target.value.replace(/\D/g, ""))
                  }
                />
              </label>
            )}
            <div className="aws-setup-sheet__actions">
              {!awsSetupWaiting && (
                <button
                  className="aws-setup-sheet__cancel"
                  type="button"
                  onClick={() => setAwsSetupOpen(false)}
                >
                  Cancel
                </button>
              )}
              <button
                className="aws-setup-sheet__primary"
                type={awsSetupWaiting ? "button" : "submit"}
                disabled={!awsSetupWaiting && !/^\d{12}$/.test(awsAccountId)}
                onClick={
                  awsSetupWaiting ? () => setAwsSetupOpen(false) : undefined
                }
              >
                {awsSetupWaiting ? "Hide" : "Open AWS setup"}
              </button>
            </div>
          </form>
        </div>
      )}

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
          viewBox="0 0 1000 560"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M500 280C420 235 270 85 90 55M500 280C455 205 420 40 350 45M500 280C555 195 600 95 665 70M500 280C625 225 745 65 910 50M500 280C405 245 290 300 185 265M500 280C615 245 710 335 820 300M500 280C385 335 275 450 115 500M500 280C445 355 545 415 485 490M500 280C625 345 740 470 875 505" />
          <path
            className="connectors-paths__web"
            d="M90 55C185 5 265 90 350 45M350 45C470 0 555 115 665 70M665 70C760 20 835 95 910 50M90 55C35 165 95 225 185 265M910 50C970 165 910 245 820 300M185 265C80 350 50 430 115 500M115 500C245 550 355 450 485 490M485 490C620 540 745 455 875 505M875 505C960 425 935 355 820 300"
          />
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
                        : beginConnect(provider))
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
