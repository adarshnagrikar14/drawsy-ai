import type { ConnectorCapability } from "../data/ConnectorsApi";

export type ConnectorTone = "coral" | "blue" | "green" | "violet" | "ink";

export const connectorCatalog: ReadonlyArray<{
  id: ConnectorCapability;
  capability: ConnectorCapability;
  name: string;
  tagLabel: string;
  detail: string;
  tone: ConnectorTone;
}> = [
  {
    id: "mail",
    capability: "mail",
    name: "Mail",
    tagLabel: "gmail",
    detail: "Search messages and bring threads into context.",
    tone: "coral",
  },
  {
    id: "calendar",
    capability: "calendar",
    name: "Calendar",
    tagLabel: "calendar",
    detail: "Read schedules and turn events into work.",
    tone: "blue",
  },
  {
    id: "notion",
    capability: "notion",
    name: "Notion",
    tagLabel: "notion",
    detail: "Reference pages, notes, and databases.",
    tone: "ink",
  },
  {
    id: "drive",
    capability: "drive",
    name: "Drive",
    tagLabel: "drive",
    detail: "Find files and attach source material.",
    tone: "green",
  },
  {
    id: "slack",
    capability: "slack",
    name: "Slack",
    tagLabel: "slack",
    detail: "Pull decisions and updates from channels.",
    tone: "violet",
  },
  {
    id: "github",
    capability: "github",
    name: "GitHub",
    tagLabel: "github",
    detail: "Connect code, issues, and pull requests.",
    tone: "ink",
  },
];

export const ConnectorLogo = ({
  capability,
}: {
  capability: ConnectorCapability;
}) => {
  if (capability === "mail") {
    return (
      <svg viewBox="0 0 32 32">
        <rect x="4" y="7" width="24" height="18" rx="3" />
        <path d="m6 10 10 8 10-8" />
      </svg>
    );
  }
  if (capability === "calendar") {
    return (
      <svg viewBox="0 0 32 32">
        <rect x="5" y="6" width="22" height="21" rx="3" />
        <path d="M5 12h22M10 4v5M22 4v5" />
        <path d="M11 17h3M18 17h3M11 22h3M18 22h3" />
      </svg>
    );
  }
  if (capability === "notion") {
    return (
      <svg viewBox="0 0 32 32">
        <path d="M7 6.5 22 5l3 2.5v18L10 27l-3-2.5Z" />
        <path d="M10 10v13M12 10l8 12V9M18 9h4" />
      </svg>
    );
  }
  if (capability === "drive") {
    return (
      <svg viewBox="0 0 32 32">
        <path d="M13 5h6l9 15-3 6h-6L10 11Z" />
        <path d="M10 11 4 21l3 5h18M4 21h18" />
      </svg>
    );
  }
  if (capability === "slack") {
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
