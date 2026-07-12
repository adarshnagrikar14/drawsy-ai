import { useEffect, useMemo, useState } from "react";

import "./JiraWorkspace.scss";

type StatusId = "todo" | "progress" | "review" | "done";
type IssueType = "Bug" | "Task" | "Story";
type Priority = "High" | "Medium" | "Low";
type View = "work" | "board" | "backlog" | "queues";
type OwnershipFilter = "all" | "open" | "mine";
type Roughness = "clean" | "balanced" | "sketchy";
type Corners = "square" | "rounded" | "pill";

type Person = {
  id: string;
  name: string;
  initials: string;
  tone: string;
};

type JiraIssue = {
  id: string;
  key: string;
  title: string;
  status: StatusId;
  type: IssueType;
  priority: Priority;
  assigneeId: string;
  updated: string;
  description: string;
  comments: string[];
};

type Sprint = {
  id: "12" | "13" | "backlog";
  title: string;
  dates?: string;
  issueIds: string[];
};

const people: Person[] = [
  { id: "adarsh", name: "Adarsh Nagarikar", initials: "AN", tone: "amber" },
  { id: "you", name: "You", initials: "YO", tone: "rose" },
  { id: "sneha", name: "Sneha P.", initials: "SP", tone: "violet" },
  { id: "rohan", name: "Rohan S.", initials: "RS", tone: "blue" },
  { id: "priya", name: "Priya K.", initials: "PK", tone: "green" },
];

const columns: Array<{ id: StatusId; title: string; color: string }> = [
  { id: "todo", title: "To do", color: "neutral" },
  { id: "progress", title: "In progress", color: "blue" },
  { id: "review", title: "In review", color: "violet" },
  { id: "done", title: "Done", color: "green" },
];

const initialIssues: JiraIssue[] = [
  {
    id: "1",
    key: "KAN-1",
    title: "Fix sign-in timeout",
    status: "todo",
    type: "Bug",
    priority: "High",
    assigneeId: "adarsh",
    updated: "1h ago",
    description:
      "Users are being signed out while actively working. Preserve the session during normal contributor activity.",
    comments: ["Reproduced on Safari and Chrome."],
  },
  {
    id: "2",
    key: "KAN-2",
    title: "Prepare release checklist",
    status: "todo",
    type: "Task",
    priority: "Medium",
    assigneeId: "you",
    updated: "3h ago",
    description: "Collect the release checks and assign an owner to each step.",
    comments: [],
  },
  {
    id: "9",
    key: "KAN-9",
    title: "Add validation to profile form",
    status: "todo",
    type: "Bug",
    priority: "Medium",
    assigneeId: "rohan",
    updated: "1d ago",
    description: "Validate display name, team, and notification preferences.",
    comments: [],
  },
  {
    id: "11",
    key: "KAN-11",
    title: "Improve error messages",
    status: "todo",
    type: "Task",
    priority: "Low",
    assigneeId: "priya",
    updated: "2d ago",
    description: "Replace generic failures with actionable guidance.",
    comments: [],
  },
  {
    id: "3",
    key: "KAN-3",
    title: "Fix sign-in timeout",
    status: "progress",
    type: "Bug",
    priority: "High",
    assigneeId: "adarsh",
    updated: "2h ago",
    description: "Implement the agreed session refresh behavior.",
    comments: ["Token refresh path is ready for review."],
  },
  {
    id: "6",
    key: "KAN-6",
    title: "Implement password reset",
    status: "progress",
    type: "Task",
    priority: "Medium",
    assigneeId: "sneha",
    updated: "4h ago",
    description: "Add reset request, confirmation, and success states.",
    comments: [],
  },
  {
    id: "7",
    key: "KAN-7",
    title: "Add audit log for sign-ins",
    status: "progress",
    type: "Bug",
    priority: "Medium",
    assigneeId: "rohan",
    updated: "5h ago",
    description: "Record successful and failed authentication attempts.",
    comments: [],
  },
  {
    id: "4",
    key: "KAN-4",
    title: "Review workspace permissions",
    status: "review",
    type: "Story",
    priority: "High",
    assigneeId: "sneha",
    updated: "6h ago",
    description: "Verify contributor access across project and service views.",
    comments: ["Waiting on final role matrix."],
  },
  {
    id: "8",
    key: "KAN-8",
    title: "Update API rate limits",
    status: "review",
    type: "Story",
    priority: "Medium",
    assigneeId: "adarsh",
    updated: "1d ago",
    description: "Align contributor endpoints with the new rate-limit policy.",
    comments: [],
  },
  {
    id: "5",
    key: "KAN-5",
    title: "Publish onboarding update",
    status: "done",
    type: "Story",
    priority: "Low",
    assigneeId: "you",
    updated: "2d ago",
    description: "Publish the revised onboarding guide.",
    comments: [],
  },
  {
    id: "10",
    key: "KAN-10",
    title: "Refactor notification service",
    status: "done",
    type: "Task",
    priority: "Low",
    assigneeId: "rohan",
    updated: "3d ago",
    description: "Separate delivery channels from notification preferences.",
    comments: [],
  },
  {
    id: "12",
    key: "KAN-12",
    title: "Fix typo in help center",
    status: "done",
    type: "Bug",
    priority: "Low",
    assigneeId: "priya",
    updated: "4d ago",
    description: "Correct the account recovery documentation.",
    comments: [],
  },
];

const serviceIssues: JiraIssue[] = [
  {
    id: "service-1",
    key: "SRV-18",
    title: "Unable to access workspace",
    status: "todo",
    type: "Task",
    priority: "High",
    assigneeId: "you",
    updated: "12m ago",
    description:
      "Customer reports a permissions error when opening the workspace.",
    comments: [],
  },
  {
    id: "service-2",
    key: "SRV-21",
    title: "Update billing contact",
    status: "progress",
    type: "Task",
    priority: "Medium",
    assigneeId: "sneha",
    updated: "38m ago",
    description:
      "Confirm the new billing contact and update the account record.",
    comments: [],
  },
  {
    id: "service-3",
    key: "SRV-24",
    title: "Restore deleted attachment",
    status: "review",
    type: "Bug",
    priority: "Medium",
    assigneeId: "adarsh",
    updated: "2h ago",
    description:
      "Validate the recovered attachment before replying to the requester.",
    comments: [],
  },
  {
    id: "service-4",
    key: "SRV-12",
    title: "Clarify export instructions",
    status: "done",
    type: "Story",
    priority: "Low",
    assigneeId: "rohan",
    updated: "1d ago",
    description: "The help article now includes the supported export formats.",
    comments: [],
  },
];

const sprintSeed: Sprint[] = [
  {
    id: "12",
    title: "KAN Sprint 12",
    dates: "Jul 8–19",
    issueIds: ["1", "3", "5", "8", "12", "7"],
  },
  {
    id: "13",
    title: "KAN Sprint 13",
    dates: "Jul 22–Aug 2",
    issueIds: ["2", "6", "10"],
  },
  {
    id: "backlog",
    title: "Backlog",
    issueIds: ["9", "11", "4"],
  },
];

const issuePoints: Record<string, number> = {
  "1": 3,
  "2": 3,
  "3": 5,
  "4": 5,
  "5": 2,
  "6": 5,
  "7": 3,
  "8": 5,
  "9": 3,
  "10": 3,
  "11": 2,
  "12": 3,
};

const queueDefinitions = [
  { id: "all", label: "All open", count: 3 },
  { id: "mine", label: "Assigned to me", count: 1 },
  { id: "urgent", label: "Needs attention", count: 1 },
] as const;

const Icon = ({
  name,
}: {
  name:
    | "search"
    | "refresh"
    | "controls"
    | "close"
    | "chevron"
    | "more"
    | "user"
    | "switch"
    | "unlink";
}) => {
  const paths = {
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 4 4" />
      </>
    ),
    refresh: (
      <>
        <path d="M19 8a7.5 7.5 0 1 0 .4 7" />
        <path d="M19 3v5h-5" />
      </>
    ),
    controls: (
      <>
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    chevron: <path d="m8 10 4 4 4-4" />,
    more: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="19" cy="12" r="1" fill="currentColor" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6" />
      </>
    ),
    switch: (
      <>
        <path d="M4 8h13l-3-3M20 16H7l3 3" />
      </>
    ),
    unlink: (
      <>
        <path d="m9.5 14.5-1 1a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0" />
        <path d="m14.5 9.5 1-1a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0M4 4l16 16" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {paths[name]}
    </svg>
  );
};

const Avatar = ({ person }: { person: Person }) => (
  <span
    className={`jira-avatar jira-avatar--${person.tone}`}
    title={person.name}
  >
    {person.initials}
  </span>
);

const personFor = (id: string) =>
  people.find((person) => person.id === id) || people[0];

export const JiraWorkspace = ({
  onDisconnect,
}: {
  onDisconnect: () => void;
}) => {
  const [projectId, setProjectId] = useState<"software" | "service">(
    "software",
  );
  const [issuesByProject, setIssuesByProject] = useState({
    software: initialIssues,
    service: serviceIssues,
  });
  const issues = issuesByProject[projectId];
  const setIssues = (update: (current: JiraIssue[]) => JiraIssue[]) => {
    setIssuesByProject((current) => ({
      ...current,
      [projectId]: update(current[projectId]),
    }));
  };
  const [view, setView] = useState<View>("board");
  const [activeQueue, setActiveQueue] =
    useState<typeof queueDefinitions[number]["id"]>("all");
  const [filter, setFilter] = useState<OwnershipFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [draggedIssueId, setDraggedIssueId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<StatusId | null>(null);
  const [composerStatus, setComposerStatus] = useState<StatusId | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [roughness, setRoughness] = useState<Roughness>("balanced");
  const [corners, setCorners] = useState<Corners>("rounded");
  const [syncLabel, setSyncLabel] = useState("Synced just now");
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createType, setCreateType] = useState<IssueType>("Task");
  const [createPriority, setCreatePriority] = useState<Priority>("Medium");

  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".jira-popover-anchor")) {
        return;
      }
      setProjectMenuOpen(false);
      setAccountMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      setProjectMenuOpen(false);
      setAccountMenuOpen(false);
      setSelectedIssueId(null);
      setCreateOpen(false);
    };
    window.addEventListener("pointerdown", closeMenus);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeMenus);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const visibleIssues = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return issues.filter((issue) => {
      if (filter === "open" && issue.status === "done") {
        return false;
      }
      if (filter === "mine" && issue.assigneeId !== "you") {
        return false;
      }
      return (
        !normalizedSearch ||
        issue.key.toLocaleLowerCase().includes(normalizedSearch) ||
        issue.title.toLocaleLowerCase().includes(normalizedSearch) ||
        issue.type.toLocaleLowerCase().includes(normalizedSearch)
      );
    });
  }, [filter, issues, search]);

  const queueIssues = useMemo(() => {
    const openIssues = visibleIssues.filter((issue) => issue.status !== "done");
    if (activeQueue === "mine") {
      return openIssues.filter((issue) => issue.assigneeId === "you");
    }
    if (activeQueue === "urgent") {
      return openIssues.filter((issue) => issue.priority === "High");
    }
    return openIssues;
  }, [activeQueue, visibleIssues]);

  const queueCount = (queueId: typeof queueDefinitions[number]["id"]) => {
    const openIssues = visibleIssues.filter((issue) => issue.status !== "done");
    if (queueId === "mine") {
      return openIssues.filter((issue) => issue.assigneeId === "you").length;
    }
    if (queueId === "urgent") {
      return openIssues.filter((issue) => issue.priority === "High").length;
    }
    return openIssues.length;
  };

  const selectedIssue =
    issues.find((issue) => issue.id === selectedIssueId) || null;

  const patchIssue = (issueId: string, patch: Partial<JiraIssue>) => {
    setIssues((current) =>
      current.map((issue) =>
        issue.id === issueId
          ? { ...issue, ...patch, updated: "just now" }
          : issue,
      ),
    );
  };

  const addIssue = (status: StatusId) => {
    const title = draftTitle.trim();
    if (!title) {
      return;
    }
    const nextNumber =
      Math.max(0, ...issues.map((issue) => Number(issue.key.split("-")[1]))) +
      1;
    const keyPrefix = projectId === "service" ? "SRV" : "KAN";
    setIssues((current) => [
      ...current,
      {
        id: `local-${nextNumber}`,
        key: `${keyPrefix}-${nextNumber}`,
        title,
        status,
        type: "Task",
        priority: "Medium",
        assigneeId: "you",
        updated: "just now",
        description: "",
        comments: [],
      },
    ]);
    setDraftTitle("");
    setComposerStatus(null);
  };

  const createIssue = () => {
    const title = createTitle.trim();
    if (!title) {
      return;
    }
    const nextNumber =
      Math.max(0, ...issues.map((issue) => Number(issue.key.split("-")[1]))) +
      1;
    const keyPrefix = projectId === "service" ? "SRV" : "KAN";
    const issue: JiraIssue = {
      id: `local-${projectId}-${nextNumber}`,
      key: `${keyPrefix}-${nextNumber}`,
      title,
      status: "todo",
      type: createType,
      priority: createPriority,
      assigneeId: "you",
      updated: "just now",
      description: "",
      comments: [],
    };
    setIssues((current) => [issue, ...current]);
    setCreateTitle("");
    setCreateType("Task");
    setCreatePriority("Medium");
    setCreateOpen(false);
    setSelectedIssueId(issue.id);
  };

  const syncNow = () => {
    setSyncLabel("Syncing…");
    window.setTimeout(() => setSyncLabel("Synced just now"), 500);
  };

  const renderCard = (issue: JiraIssue) => {
    const assignee = personFor(issue.assigneeId);
    return (
      <article
        className={`jira-issue-card jira-issue-card--${issue.type.toLocaleLowerCase()}`}
        draggable
        key={issue.id}
        onDragStart={() => setDraggedIssueId(issue.id)}
        onDragEnd={() => {
          setDraggedIssueId(null);
          setDropStatus(null);
        }}
        onClick={() => setSelectedIssueId(issue.id)}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            setSelectedIssueId(issue.id);
          }
        }}
      >
        <div className="jira-issue-keyline">
          <span className="jira-issue-symbol" />
          <span>{issue.key}</span>
          {issue.status === "done" && <b aria-label="Done">✓</b>}
        </div>
        <strong>{issue.title}</strong>
        <div className="jira-issue-meta">
          <span
            className={`jira-issue-type jira-issue-type--${issue.type.toLocaleLowerCase()}`}
          >
            {issue.type === "Bug" ? "✳" : "▣"} {issue.type}
          </span>
          <span
            className={`jira-priority jira-priority--${issue.priority.toLocaleLowerCase()}`}
          >
            {issue.priority === "High"
              ? "↑"
              : issue.priority === "Low"
              ? "↓"
              : "="}{" "}
            {issue.priority}
          </span>
        </div>
        <div className="jira-issue-footer">
          <span>
            <Avatar person={assignee} /> {assignee.name}
          </span>
          <time>{issue.updated}</time>
        </div>
      </article>
    );
  };

  return (
    <section
      className={`jira-connected-workspace jira-roughness-${roughness} jira-corners-${corners}`}
      aria-label="Connected Jira workspace"
    >
      <div className="jira-config-dock" aria-label="Jira appearance controls">
        <div className="jira-dock-group" aria-label="Roughness">
          {(["clean", "balanced", "sketchy"] as Roughness[]).map((value) => (
            <button
              type="button"
              key={value}
              aria-label={`${value} appearance`}
              title={`${value[0].toUpperCase() + value.slice(1)} appearance`}
              className={roughness === value ? "is-active" : ""}
              onClick={() => setRoughness(value)}
            >
              <span
                className={`jira-roughness-mark jira-roughness-mark--${value}`}
              />
            </button>
          ))}
        </div>
        <span className="jira-dock-divider" />
        <div className="jira-dock-group" aria-label="Corners">
          {(["square", "rounded", "pill"] as Corners[]).map((value) => (
            <button
              type="button"
              key={value}
              aria-label={`${value} corners`}
              title={`${value[0].toUpperCase() + value.slice(1)} corners`}
              className={corners === value ? "is-active" : ""}
              onClick={() => setCorners(value)}
            >
              <span className={`jira-corner-mark jira-corner-mark--${value}`} />
            </button>
          ))}
        </div>
        <span className="jira-dock-divider" />
        <div className="jira-popover-anchor jira-dock-account">
          <button
            type="button"
            className={accountMenuOpen ? "is-active" : ""}
            aria-label="Jira account"
            aria-expanded={accountMenuOpen}
            onClick={() => {
              setAccountMenuOpen((open) => !open);
              setProjectMenuOpen(false);
            }}
          >
            <Avatar person={people[0]} />
          </button>
          {accountMenuOpen && (
            <div className="jira-menu jira-account-menu" role="menu">
              <div className="jira-account-summary">
                <Avatar person={people[0]} />
                <span>
                  <strong>Adarsh Nagarikar</strong>
                  <small>adarshnagarikar</small>
                </span>
                <b>Connected</b>
              </div>
              <div className="jira-menu-divider" />
              <button type="button">
                <span className="jira-menu-glyph">
                  <Icon name="user" />
                </span>
                <span>
                  <strong>Account details</strong>
                  <small>Atlassian contributor account</small>
                </span>
              </button>
              <button type="button">
                <span className="jira-menu-glyph">
                  <Icon name="switch" />
                </span>
                <span>
                  <strong>Switch account</strong>
                  <small>Use another Jira connection</small>
                </span>
              </button>
              <div className="jira-menu-divider" />
              <button
                type="button"
                className="jira-account-disconnect"
                onClick={onDisconnect}
              >
                <span className="jira-menu-glyph">
                  <Icon name="unlink" />
                </span>
                <span>
                  <strong>Disconnect Jira</strong>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
      <header className="jira-workspace-bar">
        <div className="jira-popover-anchor jira-project-control">
          <button
            type="button"
            className="jira-project-trigger"
            aria-expanded={projectMenuOpen}
            onClick={() => {
              setProjectMenuOpen((open) => !open);
              setAccountMenuOpen(false);
            }}
          >
            <span
              className={`jira-project-icon ${
                projectId === "service" ? "jira-project-icon--service" : ""
              }`}
            >
              {projectId === "service" ? "SM" : "JT"}
            </span>
            <strong>
              {projectId === "service"
                ? "Service Management"
                : "My Software Team"}
            </strong>
            <Icon name="chevron" />
          </button>
          {projectMenuOpen && (
            <div className="jira-menu jira-project-menu" role="menu">
              <span className="jira-menu-label">Projects</span>
              <button
                type="button"
                className={projectId === "software" ? "is-selected" : ""}
                onClick={() => {
                  setProjectId("software");
                  if (view === "queues") {
                    setView("board");
                  }
                  setProjectMenuOpen(false);
                  setSelectedIssueId(null);
                }}
              >
                <span className="jira-project-icon">JT</span>
                <span>
                  <strong>My Software Team</strong>
                  <small>Software project</small>
                </span>
                {projectId === "software" && <b>✓</b>}
              </button>
              <button
                type="button"
                className={projectId === "service" ? "is-selected" : ""}
                onClick={() => {
                  setProjectId("service");
                  if (view === "backlog") {
                    setView("queues");
                  }
                  setProjectMenuOpen(false);
                  setSelectedIssueId(null);
                }}
              >
                <span className="jira-project-icon jira-project-icon--service">
                  SM
                </span>
                <span>
                  <strong>Service Management</strong>
                  <small>Service project</small>
                </span>
                {projectId === "service" && <b>✓</b>}
              </button>
              <div className="jira-menu-divider" />
              <button type="button">
                <span className="jira-menu-glyph">＋</span>
                <span>
                  <strong>Add Jira project</strong>
                  <small>Session preview</small>
                </span>
              </button>
            </div>
          )}
        </div>

        <nav className="jira-view-tabs" aria-label="Jira resources">
          <button
            type="button"
            className={view === "work" ? "is-active" : ""}
            onClick={() => setView("work")}
          >
            Work
          </button>
          <button
            type="button"
            className={view === "board" ? "is-active" : ""}
            onClick={() => setView("board")}
          >
            Board
          </button>
          <button
            type="button"
            className={
              view === (projectId === "service" ? "queues" : "backlog")
                ? "is-active"
                : ""
            }
            onClick={() =>
              setView(projectId === "service" ? "queues" : "backlog")
            }
          >
            {projectId === "service" ? "Queues" : "Backlog"}
          </button>
        </nav>

        <label className="jira-issue-search">
          <Icon name="search" />
          <input
            aria-label="Search Jira issues"
            placeholder={`Search ${issues.length} issues`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <div className="jira-filter-tabs" aria-label="Issue ownership filter">
          {(["all", "open", "mine"] as OwnershipFilter[]).map((value) => (
            <button
              type="button"
              key={value}
              className={filter === value ? "is-active" : ""}
              onClick={() => setFilter(value)}
            >
              {value[0].toLocaleUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="jira-create-button"
          onClick={() => setCreateOpen(true)}
        >
          <span>＋</span>Create issue
        </button>

        <button
          type="button"
          className="jira-sync-button"
          aria-label={syncLabel}
          title={syncLabel}
          onClick={syncNow}
        >
          <Icon name="refresh" />
        </button>
      </header>

      {view === "board" && (
        <div className="jira-board" aria-label="Jira board">
          {columns.map((column) => {
            const columnIssues = visibleIssues.filter(
              (issue) => issue.status === column.id,
            );
            return (
              <section
                className={`jira-board-column jira-board-column--${
                  column.color
                } ${dropStatus === column.id ? "is-drop-target" : ""}`}
                key={column.id}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropStatus(column.id);
                }}
                onDragLeave={(event) => {
                  if (
                    !event.currentTarget.contains(event.relatedTarget as Node)
                  ) {
                    setDropStatus(null);
                  }
                }}
                onDrop={() => {
                  if (draggedIssueId) {
                    patchIssue(draggedIssueId, { status: column.id });
                  }
                  setDraggedIssueId(null);
                  setDropStatus(null);
                }}
              >
                <header>
                  <strong>{column.title}</strong>
                  <span>{columnIssues.length}</span>
                  {column.id === "done" && <b>✓</b>}
                </header>
                <div className="jira-column-cards">
                  {columnIssues.map(renderCard)}
                </div>
                {composerStatus === column.id ? (
                  <form
                    className="jira-new-issue-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      addIssue(column.id);
                    }}
                  >
                    <input
                      autoFocus
                      aria-label={`New issue in ${column.title}`}
                      placeholder="Issue summary"
                      value={draftTitle}
                      onChange={(event) => setDraftTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setComposerStatus(null);
                          setDraftTitle("");
                        }
                      }}
                    />
                    <button type="submit">Add</button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="jira-new-issue-button"
                    onClick={() => setComposerStatus(column.id)}
                  >
                    ＋ New issue
                  </button>
                )}
              </section>
            );
          })}
          {!visibleIssues.length && (
            <div className="jira-no-results">
              No issues match these filters.
            </div>
          )}
        </div>
      )}

      {view === "work" && (
        <div className="jira-work-view" aria-label="Jira work list">
          <header>
            <span>Issue</span>
            <span>Summary</span>
            <span>Status</span>
            <span>Type</span>
            <span>Priority</span>
            <span>Assignee</span>
            <span>Updated</span>
          </header>
          {visibleIssues.map((issue) => {
            const assignee = personFor(issue.assigneeId);
            const status = columns.find(
              (column) => column.id === issue.status,
            )!;
            return (
              <button
                type="button"
                className="jira-work-row"
                key={issue.id}
                onClick={() => setSelectedIssueId(issue.id)}
              >
                <span>
                  <i className="jira-issue-symbol" />
                  {issue.key}
                </span>
                <strong>{issue.title}</strong>
                <span
                  className={`jira-status-chip jira-status-chip--${status.color}`}
                >
                  {status.title}
                </span>
                <span>{issue.type}</span>
                <span
                  className={`jira-priority jira-priority--${issue.priority.toLocaleLowerCase()}`}
                >
                  {issue.priority}
                </span>
                <span>
                  <Avatar person={assignee} />
                  {assignee.name}
                </span>
                <time>{issue.updated}</time>
              </button>
            );
          })}
          {!visibleIssues.length && (
            <div className="jira-no-results">
              No issues match these filters.
            </div>
          )}
        </div>
      )}

      {view === "backlog" && (
        <div className="jira-backlog" aria-label="Jira backlog and sprints">
          <div className="jira-backlog-tools">
            <span>Plan upcoming work and keep the active sprint moving.</span>
            <button type="button">Filter</button>
          </div>
          <div className="jira-sprint-list">
            {sprintSeed.map((sprint) => {
              const assignedIds = new Set(
                sprintSeed.flatMap((candidate) => candidate.issueIds),
              );
              const sprintIssues = visibleIssues.filter((issue) =>
                sprint.id === "backlog"
                  ? sprint.issueIds.includes(issue.id) ||
                    !assignedIds.has(issue.id)
                  : sprint.issueIds.includes(issue.id),
              );
              const completed = sprintIssues.filter(
                (issue) => issue.status === "done",
              ).length;
              const progressing = sprintIssues.filter(
                (issue) => issue.status === "progress",
              ).length;
              return (
                <section className="jira-sprint" key={sprint.id}>
                  <header>
                    <button
                      type="button"
                      aria-label={`Collapse ${sprint.title}`}
                    >
                      ⌄
                    </button>
                    <strong>{sprint.title}</strong>
                    {sprint.dates && <span>{sprint.dates}</span>}
                    <span>{sprintIssues.length} issues</span>
                    {sprint.id !== "backlog" && (
                      <span className="jira-sprint-progress">
                        {sprintIssues.length - progressing - completed} To do
                        <i />
                        <b>{progressing} In progress</b>
                        <i />
                        <em>{completed} Done</em>
                      </span>
                    )}
                    {sprint.id === "12" && (
                      <button type="button" className="jira-sprint-action">
                        Complete sprint
                      </button>
                    )}
                    {sprint.id === "13" && (
                      <button type="button" className="jira-sprint-action">
                        Start sprint
                      </button>
                    )}
                    <Icon name="more" />
                  </header>
                  <div className="jira-sprint-columns" aria-hidden="true">
                    <span />
                    <span>Type</span>
                    <span>Key</span>
                    <span>Summary</span>
                    <span>Status</span>
                    <span>Assignee</span>
                    <span>Points</span>
                  </div>
                  {sprintIssues.map((issue) => {
                    const assignee = personFor(issue.assigneeId);
                    const status = columns.find(
                      (column) => column.id === issue.status,
                    )!;
                    return (
                      <button
                        type="button"
                        className="jira-sprint-row"
                        key={`${sprint.id}-${issue.id}`}
                        onClick={() => setSelectedIssueId(issue.id)}
                      >
                        <span className="jira-row-grip">⋮⋮</span>
                        <span
                          className={`jira-type-mark jira-type-mark--${issue.type.toLocaleLowerCase()}`}
                        >
                          {issue.type === "Bug" ? "✳" : "▣"}
                        </span>
                        <span className="jira-row-key">{issue.key}</span>
                        <strong>{issue.title}</strong>
                        <span
                          className={`jira-status-chip jira-status-chip--${status.color}`}
                        >
                          {status.title}
                        </span>
                        <span>
                          <Avatar person={assignee} />
                          {assignee.name}
                        </span>
                        <span>{issuePoints[issue.id] || 3}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="jira-sprint-create"
                    onClick={() => setCreateOpen(true)}
                  >
                    ＋ Create issue
                  </button>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {view === "queues" && (
        <div className="jira-queues" aria-label="Jira service queues">
          <aside className="jira-queue-sidebar">
            <header>
              <span>Queues</span>
              <button type="button" aria-label="Queue options">
                <Icon name="more" />
              </button>
            </header>
            {queueDefinitions.map((queue) => (
              <button
                type="button"
                key={queue.id}
                className={activeQueue === queue.id ? "is-active" : ""}
                onClick={() => setActiveQueue(queue.id)}
              >
                <span>{queue.label}</span>
                <b>{queueCount(queue.id)}</b>
              </button>
            ))}
          </aside>
          <section className="jira-queue-content">
            <header>
              <div>
                <strong>
                  {
                    queueDefinitions.find((queue) => queue.id === activeQueue)
                      ?.label
                  }
                </strong>
                <span>Requests that need contributor action</span>
              </div>
              <span>{queueIssues.length} requests</span>
            </header>
            <div className="jira-queue-columns" aria-hidden="true">
              <span>Request</span>
              <span>Summary</span>
              <span>Status</span>
              <span>Priority</span>
              <span>Assignee</span>
              <span>SLA</span>
            </div>
            {queueIssues.map((issue, index) => {
              const assignee = personFor(issue.assigneeId);
              const status = columns.find(
                (column) => column.id === issue.status,
              )!;
              return (
                <button
                  type="button"
                  className="jira-queue-row"
                  key={issue.id}
                  onClick={() => setSelectedIssueId(issue.id)}
                >
                  <span className="jira-row-key">{issue.key}</span>
                  <strong>{issue.title}</strong>
                  <span
                    className={`jira-status-chip jira-status-chip--${status.color}`}
                  >
                    {status.title}
                  </span>
                  <span
                    className={`jira-priority jira-priority--${issue.priority.toLocaleLowerCase()}`}
                  >
                    {issue.priority}
                  </span>
                  <span>
                    <Avatar person={assignee} />
                    {assignee.name}
                  </span>
                  <span className={index === 0 ? "is-urgent" : ""}>
                    {index === 0 ? "42m left" : "On track"}
                  </span>
                </button>
              );
            })}
          </section>
        </div>
      )}

      {createOpen && (
        <div className="jira-modal-backdrop" role="presentation">
          <form
            className="jira-create-dialog"
            aria-label="Create Jira issue"
            onSubmit={(event) => {
              event.preventDefault();
              createIssue();
            }}
          >
            <header>
              <div>
                <span>Create in</span>
                <strong>
                  {projectId === "service"
                    ? "Service Management"
                    : "My Software Team"}
                </strong>
              </div>
              <button
                type="button"
                aria-label="Close create issue"
                onClick={() => setCreateOpen(false)}
              >
                <Icon name="close" />
              </button>
            </header>
            <label>
              Summary
              <input
                autoFocus
                aria-label="New issue summary"
                value={createTitle}
                onChange={(event) => setCreateTitle(event.target.value)}
                placeholder="What needs to be done?"
              />
            </label>
            <div>
              <label>
                Type
                <select
                  value={createType}
                  onChange={(event) =>
                    setCreateType(event.target.value as IssueType)
                  }
                >
                  <option>Task</option>
                  <option>Bug</option>
                  <option>Story</option>
                </select>
              </label>
              <label>
                Priority
                <select
                  value={createPriority}
                  onChange={(event) =>
                    setCreatePriority(event.target.value as Priority)
                  }
                >
                  <option>Medium</option>
                  <option>High</option>
                  <option>Low</option>
                </select>
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={!createTitle.trim()}>
                Create issue
              </button>
            </footer>
          </form>
        </div>
      )}

      {selectedIssue && (
        <aside
          className="jira-issue-detail"
          aria-label={`Issue details: ${selectedIssue.key}`}
        >
          <header>
            <span>
              <i className="jira-issue-symbol" />
              {selectedIssue.key}
            </span>
            <button
              type="button"
              aria-label="Close issue details"
              onClick={() => setSelectedIssueId(null)}
            >
              <Icon name="close" />
            </button>
          </header>
          <div className="jira-detail-scroll">
            <input
              className="jira-detail-title"
              aria-label="Issue title"
              value={selectedIssue.title}
              onChange={(event) =>
                patchIssue(selectedIssue.id, { title: event.target.value })
              }
            />
            <div className="jira-detail-fields">
              <label>
                Status
                <select
                  aria-label="Issue status"
                  value={selectedIssue.status}
                  onChange={(event) =>
                    patchIssue(selectedIssue.id, {
                      status: event.target.value as StatusId,
                    })
                  }
                >
                  {columns.map((column) => (
                    <option value={column.id} key={column.id}>
                      {column.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Assignee
                <select
                  aria-label="Issue assignee"
                  value={selectedIssue.assigneeId}
                  onChange={(event) =>
                    patchIssue(selectedIssue.id, {
                      assigneeId: event.target.value,
                    })
                  }
                >
                  {people.map((person) => (
                    <option value={person.id} key={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select
                  aria-label="Issue priority"
                  value={selectedIssue.priority}
                  onChange={(event) =>
                    patchIssue(selectedIssue.id, {
                      priority: event.target.value as Priority,
                    })
                  }
                >
                  {["High", "Medium", "Low"].map((priority) => (
                    <option key={priority}>{priority}</option>
                  ))}
                </select>
              </label>
              <label>
                Type
                <select
                  aria-label="Issue type"
                  value={selectedIssue.type}
                  onChange={(event) =>
                    patchIssue(selectedIssue.id, {
                      type: event.target.value as IssueType,
                    })
                  }
                >
                  {["Bug", "Task", "Story"].map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="jira-detail-description">
              Description
              <textarea
                aria-label="Issue description"
                value={selectedIssue.description}
                onChange={(event) =>
                  patchIssue(selectedIssue.id, {
                    description: event.target.value,
                  })
                }
                placeholder="Add context, decisions, or acceptance criteria…"
              />
            </label>
            <section className="jira-detail-activity">
              <h3>Activity</h3>
              {selectedIssue.comments.length ? (
                selectedIssue.comments.map((comment, index) => (
                  <article key={`${selectedIssue.id}-${index}`}>
                    <Avatar person={people[0]} />
                    <div>
                      <strong>Adarsh Nagarikar</strong>
                      <p>{comment}</p>
                    </div>
                  </article>
                ))
              ) : (
                <p className="jira-empty-activity">No comments yet.</p>
              )}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const body = commentDraft.trim();
                  if (!body) {
                    return;
                  }
                  patchIssue(selectedIssue.id, {
                    comments: [...selectedIssue.comments, body],
                  });
                  setCommentDraft("");
                }}
              >
                <textarea
                  aria-label="Add a comment"
                  placeholder="Add a comment…"
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                />
                <button type="submit" disabled={!commentDraft.trim()}>
                  Comment
                </button>
              </form>
            </section>
          </div>
        </aside>
      )}
    </section>
  );
};
