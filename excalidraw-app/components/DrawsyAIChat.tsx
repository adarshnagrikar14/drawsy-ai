import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  alertTriangleIcon,
  boltIcon,
  brainIconThin,
  chevronRight,
  codeIcon,
  copyIcon,
  elementLinkIcon,
  LinkIcon,
  MagicIconThin,
  settingsIcon,
  shield,
  tablerCheckIcon,
} from "@excalidraw/excalidraw/components/icons";
import { copyTextToSystemClipboard } from "@excalidraw/excalidraw/clipboard";

import {
  DrawsyAgentApi,
  type DrawsyAgentAccessMode,
  type DrawsyAgentControls,
  type DrawsyAgentMetadata,
  type DrawsyBridgeEvent,
  type DrawsyCanvasContextCapture,
  type DrawsyCanvasContextRequest,
  type DrawsyCanvasImageReplacement,
  type DrawsyCanvasOperations,
  type DrawsyCanvasSnapshot,
} from "../data/DrawsyAgentApi";

import "./DrawsyAIChat.scss";

const DrawsyMarkdown = lazy(() =>
  import("./DrawsyMarkdown").then((module) => ({
    default: module.DrawsyMarkdown,
  })),
);

type DrawsyAIChatProps = {
  isOpen: boolean;
  onClose: () => void;
  theme: "light" | "dark";
  canvasId: string | null;
  canvasName: string | null;
  readCanvas: (expectedCanvasId: string) => DrawsyCanvasSnapshot;
  applyCanvas: (
    expectedCanvasId: string,
    operations: DrawsyCanvasOperations,
  ) => void;
  captureCanvas: (
    expectedCanvasId: string,
    request: DrawsyCanvasContextRequest,
  ) => Promise<DrawsyCanvasContextCapture>;
  replaceCanvasImage: (
    expectedCanvasId: string,
    replacement: DrawsyCanvasImageReplacement,
  ) => void;
  contextCaptures: DrawsyCanvasContextCapture[];
  onRemoveContext: (captureId: string) => void;
  onClearContexts: () => void;
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

type ComposerTag = {
  kind: "skill" | "plugin";
  name: string;
  label: string;
  path: string;
};

const composerTagText = (tag: ComposerTag) =>
  `${tag.kind === "skill" ? "$" : "@"}${tag.label}`;

const tagsPresentInText = (tags: ComposerTag[], text: string) =>
  tags.filter((tag) => text.includes(composerTagText(tag)));

const InlineTaggedText = ({
  text,
  tags,
}: {
  text: string;
  tags: ComposerTag[];
}) => {
  const matches = tags
    .flatMap((tag) => {
      const token = composerTagText(tag);
      const ranges: Array<{ start: number; end: number; tag: ComposerTag }> =
        [];
      let from = 0;
      while (from < text.length) {
        const start = text.indexOf(token, from);
        if (start < 0) {
          break;
        }
        ranges.push({ start, end: start + token.length, tag });
        from = start + token.length;
      }
      return ranges;
    })
    .sort((left, right) => left.start - right.start || right.end - left.end)
    .filter((match, index, all) =>
      all.slice(0, index).every((previous) => previous.end <= match.start),
    );

  if (!matches.length) {
    return <>{text}</>;
  }

  const content: ReactNode[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) {
      content.push(text.slice(cursor, match.start));
    }
    content.push(
      <span
        className={`drawsy-ai-chat__inline-tag drawsy-ai-chat__inline-tag--${match.tag.kind}`}
        key={`${match.tag.kind}:${match.tag.name}:${match.start}`}
      >
        {text.slice(match.start, match.end)}
      </span>,
    );
    cursor = match.end;
  }
  if (cursor < text.length) {
    content.push(text.slice(cursor));
  }
  return <>{content}</>;
};

type TimelineMessage = {
  kind: "message";
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  tags?: ComposerTag[];
  contexts?: Array<{
    id: string;
    previewDataURL: string;
    elementCount: number;
    sourceCount: number;
  }>;
};

type TimelineTool = {
  kind: "tool";
  id: string;
  tool: string;
  status: "inProgress" | "completed" | "failed" | "warning";
  message?: string;
  error?: string;
};

type TimelineItem = TimelineMessage | TimelineTool;

const toolActivityLabel = (activity: TimelineTool) => {
  const labels =
    activity.tool === "read_current_canvas"
      ? { inProgress: "Reading current canvas", completed: "Canvas read" }
      : activity.tool === "apply_canvas_changes"
      ? { inProgress: "Updating canvas", completed: "Canvas updated" }
      : activity.tool === "add_image_from_file"
      ? { inProgress: "Adding image to canvas", completed: "Image added" }
      : activity.tool === "capture_canvas_context"
      ? { inProgress: "Looking closer", completed: "Canvas context captured" }
      : activity.tool === "replace_canvas_image_from_file"
      ? { inProgress: "Replacing canvas image", completed: "Image replaced" }
      : { inProgress: "Working on canvas", completed: "Canvas tool finished" };

  if (activity.status === "failed") {
    return activity.error || "Canvas tool failed";
  }
  if (activity.status === "warning") {
    return activity.message || "Needs attention";
  }
  return activity.message || labels[activity.status];
};

type AgentSession = { id: string; token: string; folderName: string };

const dataURLToBlob = async (dataURL: string) => {
  const response = await fetch(dataURL);
  if (!response.ok) {
    throw new Error("Canvas context could not be prepared.");
  }
  return response.blob();
};

const uploadContextCapture = async (
  session: AgentSession,
  capture: DrawsyCanvasContextCapture,
) => {
  await DrawsyAgentApi.uploadContextAsset(session, {
    captureId: capture.id,
    role: "preview",
    assetId: "selection",
    blob: await dataURLToBlob(capture.preview.dataURL),
  });
  await Promise.all(
    capture.sourceImages.map(async (source) =>
      DrawsyAgentApi.uploadContextAsset(session, {
        captureId: capture.id,
        role: "source",
        assetId: source.id,
        blob: await dataURLToBlob(source.dataURL),
      }),
    ),
  );
};

type SlashView =
  | "model"
  | "effort"
  | "permissions"
  | "internet"
  | "skills"
  | "plugins"
  | "mcp";

type SlashItem = {
  id: string;
  title: string;
  description: string;
  meta?: string;
  selected?: boolean;
  disabled?: boolean;
  icon?: string;
  onSelect?: () => void;
};

type ActiveTagQuery = {
  trigger: "$" | "@";
  query: string;
  start: number;
  end: number;
};

const tagQueryAt = (value: string, caret: number): ActiveTagQuery | null => {
  const beforeCaret = value.slice(0, caret);
  const match = beforeCaret.match(/(^|\s)([$@])([\w:-]*)$/);
  if (!match) {
    return null;
  }
  const query = match[3] || "";
  return {
    trigger: match[2] as "$" | "@",
    query,
    start: caret - query.length - 1,
    end: caret,
  };
};

const slashCommands: Array<{
  id: Exclude<SlashView, "effort">;
  title: string;
  description: string;
}> = [
  { id: "model", title: "Model", description: "Choose model and reasoning" },
  {
    id: "permissions",
    title: "Permissions",
    description: "Control selected-folder access",
  },
  {
    id: "internet",
    title: "Internet",
    description: "Allow terminal network access",
  },
  { id: "skills", title: "Skills", description: "Use an available skill" },
  {
    id: "plugins",
    title: "Plugins",
    description: "See enabled local plugins",
  },
  { id: "mcp", title: "MCP", description: "See attached MCP servers" },
];

const SlashIcon = ({ type }: { type: string }) => {
  const icons: Record<string, ReactNode> = {
    model: brainIconThin,
    permissions: shield,
    internet: LinkIcon,
    skills: MagicIconThin,
    plugins: settingsIcon,
    mcp: elementLinkIcon,
    effort: boltIcon,
    code: codeIcon,
  };
  return icons[type] || icons.model;
};

const ActivityIndicator = ({ status }: Pick<TimelineTool, "status">) => (
  <span className="drawsy-ai-chat__activity-indicator" aria-hidden="true">
    {status === "completed"
      ? tablerCheckIcon
      : status === "failed" || status === "warning"
      ? alertTriangleIcon
      : null}
  </span>
);

const SlashMenu = ({
  title,
  view,
  items,
  selectedIndex,
  loading,
  error,
  onBack,
  onHover,
}: {
  title: string;
  view: SlashView | "root" | "tag";
  items: SlashItem[];
  selectedIndex: number;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onHover: (index: number) => void;
}) => (
  <div className="drawsy-ai-chat__slash-menu" role="listbox" aria-label={title}>
    {view !== "root" && (
      <div className="drawsy-ai-chat__slash-heading">
        <button type="button" onClick={onBack} aria-label="Back to commands">
          {chevronRight}
        </button>
        <span>{title}</span>
      </div>
    )}
    <div className="drawsy-ai-chat__slash-list">
      {loading ? (
        <div className="drawsy-ai-chat__slash-state">Loading from Codex…</div>
      ) : error ? (
        <div className="drawsy-ai-chat__slash-state drawsy-ai-chat__slash-state--error">
          {error}
        </div>
      ) : items.length ? (
        items.map((item, index) => (
          <button
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            className="drawsy-ai-chat__slash-item"
            key={item.id}
            disabled={item.disabled}
            onPointerMove={() => onHover(index)}
            onClick={item.onSelect}
          >
            <span className="drawsy-ai-chat__slash-icon">
              <SlashIcon
                type={item.icon || (view === "root" ? item.id : view)}
              />
            </span>
            <span className="drawsy-ai-chat__slash-copy">
              <span className="drawsy-ai-chat__slash-title">{item.title}</span>
              <span className="drawsy-ai-chat__slash-description">
                {item.description}
              </span>
            </span>
            {(item.meta || item.selected) && (
              <span
                className={`drawsy-ai-chat__slash-meta${
                  item.selected ? " drawsy-ai-chat__slash-meta--selected" : ""
                }`}
              >
                {item.selected ? "Active" : item.meta}
              </span>
            )}
          </button>
        ))
      ) : (
        <div className="drawsy-ai-chat__slash-state">Nothing available</div>
      )}
    </div>
  </div>
);

export const DrawsyAIChat = ({
  isOpen,
  onClose,
  theme,
  canvasId,
  canvasName,
  readCanvas,
  applyCanvas,
  captureCanvas,
  replaceCanvasImage,
  contextCaptures,
  onRemoveContext,
  onClearContexts,
}: DrawsyAIChatProps) => {
  const [draft, setDraft] = useState("");
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [composerTags, setComposerTags] = useState<ComposerTag[]>([]);
  const [activeTag, setActiveTag] = useState<ActiveTagQuery | null>(null);
  const [engine, setEngine] = useState<AgentEngine>("codex");
  const [engineMenuOpen, setEngineMenuOpen] = useState(false);
  const [folder, setFolder] = useState<{
    selectionId: string;
    name: string;
  } | null>(null);
  const [folderPicking, setFolderPicking] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<
    "idle" | "starting" | "ready" | "error"
  >("idle");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [turnRunning, setTurnRunning] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [agentMetadata, setAgentMetadata] =
    useState<DrawsyAgentMetadata | null>(null);
  const [controls, setControls] = useState<DrawsyAgentControls | null>(null);
  const [controlsLoading, setControlsLoading] = useState(false);
  const [controlsError, setControlsError] = useState<string | null>(null);
  const [slashView, setSlashView] = useState<SlashView | null>(null);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const [pendingModel, setPendingModel] = useState<string | null>(null);
  const engineSwitcherRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerHighlighterRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const copiedMessageTimerRef = useRef<number | null>(null);
  const sessionRef = useRef<AgentSession | null>(null);
  const canvasHandlersRef = useRef({
    readCanvas,
    applyCanvas,
    captureCanvas,
    replaceCanvasImage,
  });

  useEffect(() => {
    setComposerTags((current) => {
      const next = tagsPresentInText(current, draft);
      return next.length === current.length ? current : next;
    });
  }, [draft]);

  useEffect(() => {
    canvasHandlersRef.current = {
      readCanvas,
      applyCanvas,
      captureCanvas,
      replaceCanvasImage,
    };
  }, [applyCanvas, captureCanvas, readCanvas, replaceCanvasImage]);

  useEffect(() => {
    if (isOpen && contextCaptures.length) {
      textareaRef.current?.focus();
    }
  }, [contextCaptures.length, isOpen]);

  useEffect(() => {
    if (!stickToBottomRef.current || !conversationRef.current) {
      return;
    }
    conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    setShowScrollToBottom(false);
  }, [timeline, turnRunning]);

  useEffect(
    () => () => {
      if (copiedMessageTimerRef.current !== null) {
        window.clearTimeout(copiedMessageTimerRef.current);
      }
    },
    [],
  );

  const scrollToLatestMessage = () => {
    const conversation = conversationRef.current;
    if (!conversation) {
      return;
    }
    stickToBottomRef.current = true;
    setShowScrollToBottom(false);
    conversation.scrollTo({
      top: conversation.scrollHeight,
      behavior: "smooth",
    });
  };

  const copyMessage = async (message: TimelineMessage) => {
    try {
      await copyTextToSystemClipboard(message.text);
      setCopiedMessageId(message.id);
      if (copiedMessageTimerRef.current !== null) {
        window.clearTimeout(copiedMessageTimerRef.current);
      }
      copiedMessageTimerRef.current = window.setTimeout(() => {
        setCopiedMessageId(null);
        copiedMessageTimerRef.current = null;
      }, 1600);
    } catch {
      setCopiedMessageId(null);
    }
  };

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

  useEffect(() => {
    if (engine !== "codex" || !folder || !canvasId) {
      sessionRef.current = null;
      setSessionStatus(folder && !canvasId ? "error" : "idle");
      setSessionError(
        folder && !canvasId ? "Open a canvas to start Codex." : null,
      );
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    let createdSession: AgentSession | null = null;
    setSessionStatus("starting");
    setSessionError(null);
    setAgentMetadata(null);
    setControls(null);
    setSlashView(null);
    setActiveTag(null);

    const handleEvent = (event: DrawsyBridgeEvent) => {
      if (event.type === "session.ready") {
        setAgentMetadata(event.data.agent);
        setSessionStatus("ready");
        return;
      }
      if (event.type === "tool.status") {
        setTimeline((current) => {
          const activity: TimelineTool = {
            kind: "tool",
            id: event.data.itemId,
            tool: event.data.tool,
            status: event.data.status,
            message: event.data.message,
            error: event.data.error,
          };
          const index = current.findIndex(
            (item) => item.kind === "tool" && item.id === activity.id,
          );
          if (index < 0) {
            return [...current, activity];
          }
          const next = [...current];
          next[index] = {
            ...next[index],
            status: activity.status,
            ...(activity.message !== undefined
              ? { message: activity.message }
              : {}),
            ...(activity.error !== undefined ? { error: activity.error } : {}),
          } as TimelineTool;
          return next;
        });
        return;
      }
      if (event.type === "assistant.delta") {
        setTimeline((current) => {
          const index = current.findIndex(
            (item) => item.kind === "message" && item.id === event.data.itemId,
          );
          if (index < 0) {
            return [
              ...current,
              {
                kind: "message",
                id: event.data.itemId,
                role: "assistant",
                text: event.data.delta,
              },
            ];
          }
          const next = [...current];
          next[index] = {
            ...next[index],
            text: (next[index] as TimelineMessage).text + event.data.delta,
          } as TimelineMessage;
          return next;
        });
        return;
      }
      if (event.type === "assistant.final") {
        setTimeline((current) => {
          const index = current.findIndex(
            (item) => item.kind === "message" && item.id === event.data.itemId,
          );
          if (index < 0) {
            return [
              ...current,
              {
                kind: "message",
                id: event.data.itemId,
                role: "assistant",
                text: event.data.text,
              },
            ];
          }
          const next = [...current];
          next[index] = {
            ...next[index],
            text: event.data.text,
          } as TimelineMessage;
          return next;
        });
        return;
      }
      if (event.type === "turn.status") {
        if (event.data.status !== "inProgress") {
          setTurnRunning(false);
        }
        if (event.data.error) {
          setTimeline((current) => [
            ...current,
            {
              kind: "message",
              id: crypto.randomUUID(),
              role: "error",
              text: event.data.error!,
            },
          ]);
        }
        return;
      }
      if (event.type === "error") {
        setTurnRunning(false);
        setTimeline((current) => [
          ...current,
          {
            kind: "message",
            id: crypto.randomUUID(),
            role: "error",
            text: event.data.message,
          },
        ]);
        return;
      }
      if (event.type === "canvas.request" && createdSession) {
        const session = createdSession;
        void (async () => {
          try {
            if (event.data.canvasId !== canvasId) {
              throw new Error("The active canvas changed. Please retry.");
            }
            let data: unknown;
            if (event.data.action === "read") {
              data = canvasHandlersRef.current.readCanvas(event.data.canvasId);
            } else if (event.data.action === "apply") {
              canvasHandlersRef.current.applyCanvas(
                event.data.canvasId,
                event.data.operations || {
                  upsertElements: [],
                  deleteElementIds: [],
                  files: [],
                },
              );
              data = { ok: true };
            } else if (event.data.action === "capture") {
              if (!event.data.contextRequest) {
                throw new Error("The canvas context request is missing.");
              }
              const capture = await canvasHandlersRef.current.captureCanvas(
                event.data.canvasId,
                event.data.contextRequest,
              );
              await uploadContextCapture(session, capture);
              data = {
                id: capture.id,
                elementIds: capture.elementIds,
                bounds: capture.bounds,
              };
            } else {
              if (!event.data.imageReplacement) {
                throw new Error("The canvas image replacement is missing.");
              }
              canvasHandlersRef.current.replaceCanvasImage(
                event.data.canvasId,
                event.data.imageReplacement,
              );
              data = { ok: true };
            }
            await DrawsyAgentApi.respondToCanvas(session, {
              requestId: event.data.requestId,
              ok: true,
              data,
            });
          } catch (error) {
            await DrawsyAgentApi.respondToCanvas(session, {
              requestId: event.data.requestId,
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Canvas operation failed.",
            });
          }
        })();
      }
    };

    void DrawsyAgentApi.createSession({
      selectionId: folder.selectionId,
      canvasId,
      canvasName: canvasName || "Untitled",
    })
      .then((session) => {
        createdSession = session;
        if (cancelled) {
          return DrawsyAgentApi.closeSession(session);
        }
        sessionRef.current = session;
        return DrawsyAgentApi.streamEvents(
          session,
          controller.signal,
          handleEvent,
        );
      })
      .catch((error) => {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        setSessionStatus("error");
        setSessionError(
          error instanceof Error ? error.message : "Drawsy AI could not start.",
        );
      });

    return () => {
      cancelled = true;
      controller.abort();
      sessionRef.current = null;
      if (createdSession) {
        void DrawsyAgentApi.closeSession(createdSession);
      }
    };
  }, [canvasId, canvasName, engine, folder]);

  const selectedEngine = agentEngines.find((option) => option.id === engine)!;
  const slashQueryOpen =
    draft.startsWith("/") &&
    !draft.slice(1).includes(" ") &&
    !draft.includes("\n");
  const slashMenuOpen =
    engine === "codex" &&
    sessionStatus === "ready" &&
    (slashQueryOpen || slashView !== null);
  const tagMenuOpen =
    engine === "codex" && sessionStatus === "ready" && activeTag !== null;
  const composerMenuOpen = slashMenuOpen || tagMenuOpen;

  useEffect(() => {
    if (!composerMenuOpen || controls) {
      return;
    }
    const session = sessionRef.current;
    if (!session) {
      return;
    }
    let cancelled = false;
    setControlsLoading(true);
    setControlsError(null);
    void DrawsyAgentApi.getControls(session)
      .then((nextControls) => {
        if (!cancelled) {
          setControls(nextControls);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setControlsError(
            error instanceof Error
              ? error.message
              : "Codex controls could not load.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setControlsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [composerMenuOpen, controls]);

  useEffect(() => {
    setSlashSelectedIndex(0);
  }, [activeTag, draft, slashView]);

  const chooseFolder = async () => {
    if (folderPicking) {
      return;
    }
    setFolderPicking(true);
    setSessionError(null);
    try {
      const selection = await DrawsyAgentApi.pickFolder();
      setFolder(selection);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Folder selection failed.";
      if (!message.toLowerCase().includes("cancelled")) {
        setSessionError(message);
      }
    } finally {
      setFolderPicking(false);
    }
  };

  const submitDraft = async () => {
    const writtenMessage = draft.trim();
    const submittedContexts = contextCaptures;
    if ((!writtenMessage && !submittedContexts.length) || turnRunning) {
      return;
    }
    const message = writtenMessage || "Work with this canvas selection.";
    const submittedTags = tagsPresentInText(composerTags, message);
    if (engine !== "codex") {
      setTimeline((current) => [
        ...current,
        {
          kind: "message",
          id: crypto.randomUUID(),
          role: "user",
          text: message,
          tags: submittedTags,
          contexts: submittedContexts.map((capture) => ({
            id: capture.id,
            previewDataURL: capture.preview.dataURL,
            elementCount: capture.elementIds.length,
            sourceCount: capture.sourceImages.length,
          })),
        },
        {
          kind: "message",
          id: crypto.randomUUID(),
          role: "error",
          text: "OpenCode is not connected in this local Codex build.",
        },
      ]);
      setDraft("");
      setComposerTags([]);
      setActiveTag(null);
      return;
    }
    const session = sessionRef.current;
    if (!session || sessionStatus !== "ready") {
      if (!folder) {
        void chooseFolder();
      }
      return;
    }
    setTurnRunning(true);
    try {
      await Promise.all(
        submittedContexts.map((capture) =>
          uploadContextCapture(session, capture),
        ),
      );
      await DrawsyAgentApi.startTurn(
        session,
        message,
        {
          skills: submittedTags
            .filter((tag) => tag.kind === "skill")
            .map(({ name, path }) => ({ name, path })),
          plugins: submittedTags
            .filter((tag) => tag.kind === "plugin")
            .map(({ name, path }) => ({ name, path })),
        },
        submittedContexts.map((capture) => ({
          id: capture.id,
          elementIds: capture.elementIds,
          bounds: capture.bounds,
        })),
      );
      setTimeline((current) => [
        ...current,
        {
          kind: "message",
          id: crypto.randomUUID(),
          role: "user",
          text: message,
          tags: submittedTags,
          contexts: submittedContexts.map((capture) => ({
            id: capture.id,
            previewDataURL: capture.preview.dataURL,
            elementCount: capture.elementIds.length,
            sourceCount: capture.sourceImages.length,
          })),
        },
      ]);
      setDraft("");
      setComposerTags([]);
      setActiveTag(null);
      onClearContexts();
    } catch (error) {
      setTurnRunning(false);
      setTimeline((current) => [
        ...current,
        {
          kind: "message",
          id: crypto.randomUUID(),
          role: "error",
          text:
            error instanceof Error
              ? error.message
              : "Codex could not start the turn.",
        },
      ]);
    }
  };

  const updateAgentSettings = async (settings: {
    model?: string;
    effort?: string;
    accessMode?: DrawsyAgentAccessMode;
    internetEnabled?: boolean;
  }) => {
    const session = sessionRef.current;
    if (!session) {
      return;
    }
    setControlsLoading(true);
    setControlsError(null);
    try {
      const result = await DrawsyAgentApi.updateSettings(session, settings);
      setAgentMetadata(result.agent);
      setControls(result.controls);
      setSlashView(null);
      setPendingModel(null);
      setDraft("");
      textareaRef.current?.focus();
    } catch (error) {
      setControlsError(
        error instanceof Error ? error.message : "Codex setting did not apply.",
      );
    } finally {
      setControlsLoading(false);
    }
  };

  const showSlashView = (view: Exclude<SlashView, "effort">) => {
    setDraft("");
    setSlashView(view);
    setPendingModel(null);
  };

  const addComposerTag = (
    tag: ComposerTag,
    query: ActiveTagQuery | null = null,
  ) => {
    setComposerTags((current) =>
      current.some((item) => item.kind === tag.kind && item.name === tag.name)
        ? current
        : [...current, tag],
    );
    const insertionStart =
      query?.start ?? textareaRef.current?.selectionStart ?? draft.length;
    const insertionEnd =
      query?.end ?? textareaRef.current?.selectionEnd ?? insertionStart;
    const before = draft.slice(0, insertionStart);
    const after = draft.slice(insertionEnd);
    const token = composerTagText(tag);
    const leadingSpace = before && !/\s$/.test(before) ? " " : "";
    const trailingSpace = !after || !/^\s/.test(after) ? " " : "";
    const insertedText = `${leadingSpace}${token}${trailingSpace}`;
    const nextDraft = `${before}${insertedText}${after}`;
    const nextCaret = insertionStart + insertedText.length;
    setDraft(nextDraft);
    setActiveTag(null);
    setSlashView(null);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const availableTagItems: SlashItem[] = activeTag
    ? activeTag.trigger === "$"
      ? (controls?.skills || []).map((skill) => ({
          id: skill.name,
          title: skill.displayName,
          description: skill.description,
          icon: "skills",
          selected: composerTags.some(
            (tag) => tag.kind === "skill" && tag.name === skill.name,
          ),
          onSelect: () =>
            addComposerTag(
              {
                kind: "skill",
                name: skill.name,
                label: skill.displayName,
                path: skill.path,
              },
              activeTag,
            ),
        }))
      : (controls?.plugins || []).map((plugin) => ({
          id: plugin.id,
          title: plugin.name,
          description: plugin.description,
          icon: "plugins",
          selected: composerTags.some(
            (tag) => tag.kind === "plugin" && tag.name === plugin.name,
          ),
          onSelect: () =>
            addComposerTag(
              {
                kind: "plugin",
                name: plugin.name,
                label: plugin.name,
                path: plugin.path,
              },
              activeTag,
            ),
        }))
    : [];
  const tagItems = activeTag
    ? availableTagItems.filter((item) =>
        `${item.title} ${item.description}`
          .toLowerCase()
          .includes(activeTag.query.toLowerCase()),
      )
    : [];

  const slashRootItems: SlashItem[] = slashCommands
    .filter((command) =>
      command.title.toLowerCase().includes(draft.slice(1).trim().toLowerCase()),
    )
    .map((command) => ({
      id: command.id,
      title: command.title,
      description: command.description,
      onSelect: () => showSlashView(command.id),
    }));

  const currentSlashView: SlashView | "root" = slashView || "root";
  let slashTitle = "Commands";
  let slashItems = slashRootItems;
  if (slashView === "model") {
    slashTitle = "Model";
    slashItems = (controls?.models || []).map((model) => ({
      id: model.id,
      title: model.displayName,
      description: model.description,
      selected: agentMetadata?.model === model.model,
      meta: model.isDefault ? "Default" : undefined,
      onSelect: () => {
        if (model.efforts.length > 1) {
          setPendingModel(model.model);
          setSlashView("effort");
          return;
        }
        void updateAgentSettings({
          model: model.model,
          effort: model.efforts[0]?.id || model.defaultEffort,
        });
      },
    }));
  } else if (slashView === "effort") {
    slashTitle = "Reasoning";
    const model = controls?.models.find(
      (option) => option.model === pendingModel,
    );
    slashItems = (model?.efforts || []).map((effort) => ({
      id: effort.id,
      title: effort.id.charAt(0).toUpperCase() + effort.id.slice(1),
      description: effort.description,
      selected:
        agentMetadata?.model === model?.model &&
        agentMetadata?.reasoningEffort === effort.id,
      onSelect: () =>
        void updateAgentSettings({ model: model?.model, effort: effort.id }),
    }));
  } else if (slashView === "permissions") {
    slashTitle = "Permissions";
    slashItems = [
      {
        id: "workspace",
        title: "Current folder",
        description: "Read and change files only in the selected folder",
        selected: controls?.accessMode === "workspace",
        onSelect: () => void updateAgentSettings({ accessMode: "workspace" }),
      },
      {
        id: "readOnly",
        title: "Read only",
        description: "Inspect the selected folder without changing files",
        selected: controls?.accessMode === "readOnly",
        onSelect: () => void updateAgentSettings({ accessMode: "readOnly" }),
      },
    ];
  } else if (slashView === "internet") {
    slashTitle = "Internet";
    slashItems = [
      {
        id: "off",
        title: "Blocked",
        description: "No terminal network access",
        selected: controls?.internetEnabled === false,
        onSelect: () => void updateAgentSettings({ internetEnabled: false }),
      },
      {
        id: "on",
        title: "Allowed",
        description: "Terminal network only; Browser and Computer stay off",
        selected: controls?.internetEnabled === true,
        onSelect: () => void updateAgentSettings({ internetEnabled: true }),
      },
    ];
  } else if (slashView === "skills") {
    slashTitle = "Tag a skill";
    slashItems = (controls?.skills || []).map((skill) => ({
      id: skill.name,
      title: skill.displayName,
      description: skill.description,
      onSelect: () =>
        addComposerTag({
          kind: "skill",
          name: skill.name,
          label: skill.displayName,
          path: skill.path,
        }),
    }));
  } else if (slashView === "plugins") {
    slashTitle = "Tag a plugin";
    slashItems = (controls?.plugins || []).map((plugin) => ({
      id: plugin.id,
      title: plugin.name,
      description: plugin.description,
      onSelect: () =>
        addComposerTag({
          kind: "plugin",
          name: plugin.name,
          label: plugin.name,
          path: plugin.path,
        }),
    }));
  } else if (slashView === "mcp") {
    slashTitle = "MCP servers";
    slashItems = (controls?.mcpServers || []).map((server) => ({
      id: server.name,
      title: server.name === "drawsy" ? "Drawsy canvas" : server.name,
      description: `${server.toolCount} tool${
        server.toolCount === 1 ? "" : "s"
      } available`,
      meta: server.name === "drawsy" ? "Required" : "Ready",
      disabled: true,
    }));
  }

  const visibleMenuItems = tagMenuOpen ? tagItems : slashItems;

  const chooseComposerMenuItem = () => {
    const item = visibleMenuItems[slashSelectedIndex];
    if (item && !item.disabled) {
      item.onSelect?.();
    }
  };

  const closeComposerMenu = () => {
    setActiveTag(null);
    setSlashView(null);
    setPendingModel(null);
    if (slashQueryOpen) {
      setDraft("");
    }
  };

  return (
    <aside
      className={`drawsy-ai-chat drawsy-ai-chat--${theme}`}
      aria-label="Drawsy AI chat"
      hidden={!isOpen}
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

      <div
        className="drawsy-ai-chat__conversation"
        aria-live="polite"
        ref={conversationRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          const isAtBottom =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            72;
          stickToBottomRef.current = isAtBottom;
          setShowScrollToBottom(
            !isAtBottom && element.scrollHeight > element.clientHeight,
          );
        }}
      >
        {timeline.length === 0 ? (
          <div className="drawsy-ai-chat__empty">
            <span className="drawsy-ai-chat__empty-mark" aria-hidden="true">
              <DrawsyMark />
            </span>
            <h2>What are we making?</h2>
          </div>
        ) : (
          <div className="drawsy-ai-chat__messages">
            {timeline.map((item) =>
              item.kind === "message" ? (
                <div
                  className={`drawsy-ai-chat__message drawsy-ai-chat__message--${item.role}`}
                  key={item.id}
                >
                  {!!item.contexts?.length && (
                    <div className="drawsy-ai-chat__sent-contexts">
                      {item.contexts.map((context) => (
                        <div
                          className="drawsy-ai-chat__sent-context"
                          key={context.id}
                        >
                          <img
                            src={context.previewDataURL}
                            alt="Attached canvas selection"
                          />
                          <span>
                            {context.elementCount} object
                            {context.elementCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="drawsy-ai-chat__message-content">
                    {item.role === "assistant" ? (
                      <Suspense
                        fallback={
                          <div className="drawsy-ai-chat__markdown drawsy-ai-chat__markdown--loading">
                            {item.text}
                          </div>
                        }
                      >
                        <DrawsyMarkdown copyCode={item.role === "assistant"}>
                          {item.text}
                        </DrawsyMarkdown>
                      </Suspense>
                    ) : item.role === "user" ? (
                      <InlineTaggedText
                        text={item.text}
                        tags={item.tags || []}
                      />
                    ) : (
                      item.text
                    )}
                  </div>
                  <div className="drawsy-ai-chat__message-actions">
                    <button
                      type="button"
                      className="drawsy-ai-chat__message-copy"
                      onClick={() => void copyMessage(item)}
                      aria-label={
                        copiedMessageId === item.id
                          ? "Message copied"
                          : "Copy message"
                      }
                      title={
                        copiedMessageId === item.id ? "Copied" : "Copy message"
                      }
                    >
                      {copiedMessageId === item.id ? tablerCheckIcon : copyIcon}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`drawsy-ai-chat__activity drawsy-ai-chat__activity--${item.status}`}
                  key={item.id}
                >
                  <ActivityIndicator status={item.status} />
                  <span>{toolActivityLabel(item)}</span>
                </div>
              ),
            )}
            {turnRunning &&
              !timeline.some(
                (item) => item.kind === "tool" && item.status === "inProgress",
              ) && (
                <div className="drawsy-ai-chat__activity drawsy-ai-chat__activity--inProgress">
                  <ActivityIndicator status="inProgress" />
                  <span>Thinking</span>
                </div>
              )}
          </div>
        )}
      </div>

      <div className="drawsy-ai-chat__composer-wrap">
        {showScrollToBottom && (
          <button
            type="button"
            className="drawsy-ai-chat__scroll-to-bottom"
            onClick={scrollToLatestMessage}
            aria-label="Scroll to latest message"
            title="Scroll to latest"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m5.5 8 4.5 4.5L14.5 8" />
            </svg>
          </button>
        )}
        {composerMenuOpen && (
          <SlashMenu
            title={
              tagMenuOpen
                ? activeTag?.trigger === "$"
                  ? "Tag a skill"
                  : "Tag a plugin"
                : slashTitle
            }
            view={tagMenuOpen ? "tag" : currentSlashView}
            items={visibleMenuItems}
            selectedIndex={slashSelectedIndex}
            loading={
              controlsLoading && (tagMenuOpen || currentSlashView !== "root")
            }
            error={
              tagMenuOpen || currentSlashView !== "root" ? controlsError : null
            }
            onBack={() => {
              if (tagMenuOpen) {
                setActiveTag(null);
              } else if (slashView === "effort") {
                setSlashView("model");
                setPendingModel(null);
              } else {
                setSlashView(null);
                setDraft("/");
              }
            }}
            onHover={setSlashSelectedIndex}
          />
        )}
        <form
          className="drawsy-ai-chat__composer"
          onSubmit={(event) => {
            event.preventDefault();
            void submitDraft();
          }}
        >
          <div className="drawsy-ai-chat__composer-input">
            {!!contextCaptures.length && (
              <div
                className="drawsy-ai-chat__context-list"
                aria-label="Attached canvas context"
              >
                {contextCaptures.map((capture) => (
                  <div className="drawsy-ai-chat__context" key={capture.id}>
                    <img
                      src={capture.preview.dataURL}
                      alt="Canvas selection preview"
                    />
                    <span className="drawsy-ai-chat__context-copy">
                      <strong>Canvas selection</strong>
                      <small>
                        {capture.elementIds.length} object
                        {capture.elementIds.length === 1 ? "" : "s"}
                        {capture.sourceImages.length
                          ? ` · ${capture.sourceImages.length} source${
                              capture.sourceImages.length === 1 ? "" : "s"
                            }`
                          : ""}
                      </small>
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveContext(capture.id)}
                      aria-label="Remove canvas selection"
                      title="Remove selection"
                    >
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="m5 5 6 6m0-6-6 6" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="drawsy-ai-chat__composer-editor">
              <div
                className="drawsy-ai-chat__composer-highlighter"
                ref={composerHighlighterRef}
                aria-hidden="true"
              >
                <InlineTaggedText
                  text={draft}
                  tags={tagsPresentInText(composerTags, draft)}
                />
                {draft.endsWith("\n") && "\u200b"}
              </div>
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => {
                  const value = event.target.value;
                  const caret = event.target.selectionStart ?? value.length;
                  setDraft(value);
                  setActiveTag(
                    value.startsWith("/") ? null : tagQueryAt(value, caret),
                  );
                  if (slashView && value) {
                    setSlashView(null);
                    setPendingModel(null);
                  }
                }}
                onScroll={(event) => {
                  if (composerHighlighterRef.current) {
                    composerHighlighterRef.current.scrollTop =
                      event.currentTarget.scrollTop;
                    composerHighlighterRef.current.scrollLeft =
                      event.currentTarget.scrollLeft;
                  }
                }}
                onClick={(event) =>
                  setActiveTag(
                    tagQueryAt(
                      event.currentTarget.value,
                      event.currentTarget.selectionStart ?? draft.length,
                    ),
                  )
                }
                onKeyUp={(event) => {
                  if (
                    event.key !== "ArrowDown" &&
                    event.key !== "ArrowUp" &&
                    event.key !== "Enter" &&
                    event.key !== "Escape"
                  ) {
                    setActiveTag(
                      tagQueryAt(
                        event.currentTarget.value,
                        event.currentTarget.selectionStart ?? draft.length,
                      ),
                    );
                  }
                }}
                onKeyDown={(event) => {
                  if (composerMenuOpen) {
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault();
                      if (visibleMenuItems.length) {
                        const direction = event.key === "ArrowDown" ? 1 : -1;
                        setSlashSelectedIndex(
                          (slashSelectedIndex +
                            direction +
                            visibleMenuItems.length) %
                            visibleMenuItems.length,
                        );
                      }
                      return;
                    }
                    if (event.key === "Enter") {
                      event.preventDefault();
                      chooseComposerMenuItem();
                      return;
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      closeComposerMenu();
                      return;
                    }
                    if (
                      event.key === "Backspace" &&
                      slashView &&
                      draft.length === 0
                    ) {
                      event.preventDefault();
                      if (slashView === "effort") {
                        setSlashView("model");
                        setPendingModel(null);
                      } else {
                        setSlashView(null);
                        setDraft("/");
                      }
                      return;
                    }
                  }
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submitDraft();
                  }
                }}
                rows={1}
                placeholder={
                  folder
                    ? contextCaptures.length
                      ? "Tell Drawsy what to do…"
                      : "Ask Drawsy anything…"
                    : "Choose a folder to begin…"
                }
                aria-label="Message Drawsy AI"
              />
            </div>
          </div>
          <div className="drawsy-ai-chat__composer-menu">
            <div className="drawsy-ai-chat__composer-options">
              <button
                type="button"
                className="drawsy-ai-chat__tool drawsy-ai-chat__folder"
                aria-label={
                  folder ? `Selected folder: ${folder.name}` : "Choose folder"
                }
                title={
                  folder ? "Change working folder" : "Choose working folder"
                }
                onClick={() => void chooseFolder()}
                disabled={folderPicking}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h3l1.4 1.6H15A1.5 1.5 0 0 1 16.5 8v6A1.5 1.5 0 0 1 15 15.5H5A1.5 1.5 0 0 1 3.5 14V6.5Z" />
                  <path d="M3.8 8h12.4" />
                </svg>
                <span>
                  {folderPicking
                    ? "Choosing…"
                    : folder?.name || "Choose folder"}
                </span>
              </button>
            </div>
            <button
              type="submit"
              className="drawsy-ai-chat__send"
              disabled={
                (!draft.trim() && !contextCaptures.length) ||
                turnRunning ||
                (engine === "codex" && sessionStatus !== "ready")
              }
              aria-label="Send message"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 15V5m0 0L6.5 8.5M10 5l3.5 3.5" />
              </svg>
            </button>
          </div>
        </form>
        <div className="drawsy-ai-chat__session-meta">
          <span
            className={
              sessionError ? "drawsy-ai-chat__status--error" : undefined
            }
          >
            {sessionError ||
              (sessionStatus === "starting"
                ? "Starting local Codex…"
                : sessionStatus === "ready" && folder
                ? `${folder.name} · current canvas only`
                : "Local Codex · no internet")}
          </span>
          {agentMetadata && !sessionError && (
            <span>
              {agentMetadata.model} ·{" "}
              {agentMetadata.reasoningEffort
                ? `${agentMetadata.reasoningEffort} reasoning`
                : "default reasoning"}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
};
