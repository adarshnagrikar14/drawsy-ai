import { useEffect, useRef, useState } from "react";

import "./DrawsyAIChat.scss";

type DrawsyAIChatProps = {
  onClose: () => void;
  theme: "light" | "dark";
};

type AgentEngine = "opencode" | "codex";

const agentEngines: { id: AgentEngine; label: string }[] = [
  { id: "opencode", label: "OpenCode" },
  { id: "codex", label: "Codex" },
];

const EngineMark = ({
  engine,
}: {
  engine: AgentEngine;
  theme: DrawsyAIChatProps["theme"];
}) =>
  engine === "opencode" ? (
    <svg
      className="drawsy-ai-chat__engine-logo drawsy-ai-chat__engine-logo--opencode"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path fillRule="evenodd" d="M3 5h18v14H3V5Zm5 4v6h8V9H8Z" />
    </svg>
  ) : (
    <svg
      className="drawsy-ai-chat__engine-logo drawsy-ai-chat__engine-logo--codex"
      viewBox="0 0 256 260"
      aria-hidden="true"
    >
      <path d="M239.183914 106.202783C245.054304 88.52421 243.02228 69.17338 233.607599 53.099886 219.451678 28.458802 190.999703 15.783613 163.213007 21.739505 147.554077 4.321459 123.794909-3.423986 100.87901 1.418739 77.963111 6.261463 59.369009 22.957254 52.095962 45.221422 33.843649 48.964487 18.090172 60.392749 8.866725 76.581803-5.443491 101.182962-2.195444 132.215255 16.898666 153.320094 11.006087 170.990656 13.019728 190.343991 22.423823 206.422991 36.597555 231.072344 65.068034 243.746566 92.869574 237.783372 105.235639 251.708249 123.001113 259.630942 141.623968 259.52692 170.105359 259.552169 195.337611 241.165718 204.037777 214.045661 222.28734 210.296356 238.038489 198.869783 247.267014 182.68528 261.404453 158.127515 258.142494 127.262775 239.183914 106.202783Zm-97.559946 136.338424c-11.368286.01797-22.380092-3.966565-31.104587-11.25501l1.534765-.869701 51.670449-29.825615a8.53 8.53 0 0 0 4.246186-7.366876v-72.850217l21.844833 12.636238a.77.77 0 0 1 .409271.562748v60.367455c-.056282 26.818198-21.782719 48.544635-48.600917 48.600978ZM37.157575 197.93062c-5.701077-9.844261-7.748093-21.383636-5.780951-32.588194l1.534766.920859 51.721607 29.825616a8.43 8.43 0 0 0 8.441212 0l63.181193-36.425108v25.221318a.87.87 0 0 1-.358112.665065l-52.335514 30.183727c-23.256281 13.397729-52.969281 5.431532-66.404201-17.803283ZM23.549318 85.381127c5.740668-9.907817 14.801873-17.464862 25.57943-21.333244v61.390632a8.43 8.43 0 0 0 4.195027 7.315717l62.874239 36.271632-21.844833 12.636238a.8.8 0 0 1-.767383 0l-52.233196-30.132568c-23.210659-13.453436-31.170834-43.143972-17.803284-66.404201v.255794Zm179.465282 41.694471-63.078875-36.629743 21.793675-12.58508a.8.8 0 0 1 .767383 0l52.233196 30.183727c16.30235 9.407245 25.707315 27.381607 24.141525 46.138237-1.56579 18.756629-13.820785 34.922833-31.457242 41.496891v-61.390632a8.43 8.43 0 0 0-4.399662-7.2134Zm21.742516-32.690511-1.534766-.92086-51.61929-30.08141a8.43 8.43 0 0 0-8.492371 0L99.980655 99.807926V74.586608a.82.82 0 0 1 .306954-.665065l52.233196-30.132569c16.342293-9.414622 36.653451-8.536069 52.121774 2.254489 15.468324 10.790579 23.30669 29.548912 20.114537 48.136988v.204636ZM88.060641 139.097931l-21.844833-12.58508a.77.77 0 0 1-.409271-.613906V65.684966c.024912-18.856429 10.943523-36.000363 28.020548-43.99666 17.077025-7.996299 37.236748-5.40476 51.736115 6.649992l-1.534766.870401-51.670449 29.825615a8.53 8.53 0 0 0-4.246185 7.366876l-.051159 72.696741Zm11.868856-25.579431 28.137373-16.217358 28.188532 16.217358v32.434718l-28.086215 16.217359-28.188532-16.217359-.051159-32.434718Z" />
    </svg>
  );

const DrawsyMark = () => (
  <svg viewBox="0 0 1266 1266" aria-hidden="true">
    <path d="M108.957 952.946C104.24 947.642 103.581 939.865 107.339 933.843L503.063 299.706C504.966 296.658 507.839 294.338 511.22 293.122L723.583 216.707C734.009 212.955 745 220.681 745 231.762V496.958C745 501.151 743.354 505.176 740.416 508.168L213.495 1044.78C207.005 1051.39 196.278 1051.13 190.123 1044.21L108.957 952.946Z" />
    <circle cx="602" cy="436" r="60.5" />
    <path d="M669.479 725.179L526.665 872.169C523.105 875.833 521.509 880.978 522.369 886.014L549.227 1043.19C550.54 1050.88 557.201 1056.5 564.998 1056.5H726.43C736.209 1056.5 743.7 1047.81 742.254 1038.13L696.779 733.963C694.821 720.866 678.707 715.681 669.479 725.179Z" />
    <path d="M901.794 514.978L779.595 1037.36C777.247 1047.39 784.866 1057 795.175 1057H932.492C939.841 1057 946.245 1051.99 948.019 1044.86L1065.11 574.147C1067.05 566.342 1062.89 558.309 1055.4 555.382L923.197 503.72C914.123 500.174 904.013 505.492 901.794 514.978Z" />
    <path d="M963.277 289.389L933.94 393.517C931.705 401.448 935.859 409.78 943.539 412.767L1077.84 465.02C1086.73 468.477 1096.65 463.444 1099.11 454.231L1156.59 238.666C1159.92 226.164 1147.81 215.081 1135.65 219.51L973.201 278.694C968.366 280.456 964.673 284.436 963.277 289.389Z" />
  </svg>
);

export const DrawsyAIChat = ({ onClose, theme }: DrawsyAIChatProps) => {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [engine, setEngine] = useState<AgentEngine>("codex");
  const [engineMenuOpen, setEngineMenuOpen] = useState(false);
  const engineSwitcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!engineMenuOpen) {
      return;
    }

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!engineSwitcherRef.current?.contains(event.target as Node)) {
        setEngineMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEngineMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [engineMenuOpen]);

  const selectedEngine = agentEngines.find((option) => option.id === engine)!;

  const submitDraft = () => {
    const message = draft.trim();
    if (!message) {
      return;
    }
    setMessages((current) => [...current, message]);
    setDraft("");
  };

  return (
    <aside
      className={`drawsy-ai-chat drawsy-ai-chat--${theme}`}
      aria-label="Drawsy AI chat"
    >
      <header className="drawsy-ai-chat__header">
        <div className="drawsy-ai-chat__identity">
          <span className="drawsy-ai-chat__mark" aria-hidden="true">
            <DrawsyMark />
          </span>
          <span>Drawsy AI</span>
        </div>
        <div className="drawsy-ai-chat__header-actions">
          <div
            className="drawsy-ai-chat__engine-switcher"
            ref={engineSwitcherRef}
          >
            <button
              type="button"
              className="drawsy-ai-chat__engine-trigger"
              onClick={() => setEngineMenuOpen((isOpen) => !isOpen)}
              aria-haspopup="listbox"
              aria-expanded={engineMenuOpen}
              aria-label={`Agent engine: ${selectedEngine.label}`}
            >
              <span className="drawsy-ai-chat__engine-mark">
                <EngineMark engine={engine} theme={theme} />
              </span>
              <span>{selectedEngine.label}</span>
              <svg
                className="drawsy-ai-chat__engine-chevron"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="m6.5 8 3.5 3.5L13.5 8" />
              </svg>
            </button>
            {engineMenuOpen && (
              <div
                className="drawsy-ai-chat__engine-menu"
                role="listbox"
                aria-label="Choose agent engine"
              >
                {agentEngines.map((option) => {
                  const selected = option.id === engine;
                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className="drawsy-ai-chat__engine-option"
                      key={option.id}
                      onClick={() => {
                        setEngine(option.id);
                        setEngineMenuOpen(false);
                      }}
                    >
                      <span className="drawsy-ai-chat__engine-option-mark">
                        <EngineMark engine={option.id} theme={theme} />
                      </span>
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            type="button"
            className="drawsy-ai-chat__close"
            onClick={onClose}
            aria-label="Close Drawsy AI"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m5 5 10 10M15 5 5 15" />
            </svg>
          </button>
        </div>
      </header>

      <div className="drawsy-ai-chat__conversation" aria-live="polite">
        {messages.length === 0 ? (
          <div className="drawsy-ai-chat__empty">
            <span className="drawsy-ai-chat__empty-mark" aria-hidden="true">
              <DrawsyMark />
            </span>
            <h2>What are we making?</h2>
          </div>
        ) : (
          <div className="drawsy-ai-chat__messages">
            {messages.map((message, index) => (
              <div
                className="drawsy-ai-chat__message"
                key={`${index}-${message}`}
              >
                {message}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="drawsy-ai-chat__composer-wrap">
        <form
          className="drawsy-ai-chat__composer"
          onSubmit={(event) => {
            event.preventDefault();
            submitDraft();
          }}
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitDraft();
              }
            }}
            rows={1}
            placeholder="Ask Drawsy anything…"
            aria-label="Message Drawsy AI"
          />
          <div className="drawsy-ai-chat__composer-menu">
            <div className="drawsy-ai-chat__composer-options">
              <button
                type="button"
                className="drawsy-ai-chat__tool drawsy-ai-chat__tool--icon"
                aria-label="Add context"
                title="Add context"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M10 4v12M4 10h12" />
                </svg>
              </button>
              <button
                type="button"
                className="drawsy-ai-chat__tool"
                aria-label="Canvas context"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <rect x="4" y="4" width="12" height="12" rx="2" />
                  <path d="M7 8h6M7 11h4" />
                </svg>
                <span>Canvas</span>
              </button>
              <button
                type="button"
                className="drawsy-ai-chat__tool"
                aria-label="Connected sources"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <circle cx="6" cy="6" r="2" />
                  <circle cx="14" cy="6" r="2" />
                  <circle cx="10" cy="14" r="2" />
                  <path d="m7.5 7.5 1.4 4.2m3.6-4.2-1.4 4.2M8 6h4" />
                </svg>
                <span>Sources</span>
              </button>
            </div>
            <button
              type="submit"
              className="drawsy-ai-chat__send"
              disabled={!draft.trim()}
              aria-label="Send message"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 15V5m0 0L6.5 8.5M10 5l3.5 3.5" />
              </svg>
            </button>
          </div>
        </form>
        <p>Nothing changes on your canvas without your review.</p>
      </div>
    </aside>
  );
};
