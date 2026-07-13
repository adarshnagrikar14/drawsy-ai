import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fromAdf,
  toAdf,
  type JiraApi,
  type JiraConnection,
  type JiraProject,
  type JiraRemoteIssue,
  type JiraUser,
} from "../data/JiraApi";

import "./JiraWorkspace.scss";

type StatusId = "todo" | "progress" | "review" | "done";
type IssueType = string;
type Priority = string;
type View = "work" | "board" | "backlog" | "queues";
type OwnershipFilter = "all" | "open" | "mine";
type Roughness = "clean" | "balanced" | "sketchy";
type Corners = "square" | "rounded" | "pill";

type Person = {
  id: string;
  name: string;
  initials: string;
  tone: string;
  avatarUrl?: string;
};

type JiraIssue = {
  id: string;
  key: string;
  title: string;
  status: StatusId;
  type: IssueType;
  priority: Priority;
  assigneeId: string;
  assigneeName?: string;
  assigneeAvatarUrl?: string;
  updated: string;
  description: string;
  comments: string[];
  commentAuthors?: Person[];
  remoteStatusName?: string;
  sprintIds?: string[];
  points?: number;
};

type Sprint = {
  id: string;
  title: string;
  dates?: string;
  issueIds: string[];
  state?: string;
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
    {person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : person.initials}
  </span>
);

const personFor = (id: string) =>
  people.find((person) => person.id === id) || people[0];

const initialsFor = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase())
    .join("") || "?";

const personForIssue = (issue: JiraIssue): Person =>
  issue.assigneeName
    ? {
        id: issue.assigneeId,
        name: issue.assigneeName,
        initials: initialsFor(issue.assigneeName),
        tone: "violet",
        avatarUrl: issue.assigneeAvatarUrl,
      }
    : personFor(issue.assigneeId);

const statusFromJira = (fields: Record<string, any>): StatusId => {
  const category = String(
    fields.status?.statusCategory?.key || "",
  ).toLowerCase();
  const name = String(fields.status?.name || "").toLowerCase();
  if (category === "done" || name.includes("done") || name.includes("closed")) {
    return "done";
  }
  if (name.includes("review")) {
    return "review";
  }
  if (category === "indeterminate" || name.includes("progress")) {
    return "progress";
  }
  return "todo";
};

const priorityFromJira = (name: unknown): Priority => {
  return String(name || "Medium");
};

const visualToken = (value: string) =>
  value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-");

const issueFromJira = (issue: JiraRemoteIssue): JiraIssue => {
  const fields = issue.fields;
  return {
    id: issue.id,
    key: issue.key,
    title: String(fields.summary || issue.key),
    status: statusFromJira(fields),
    type: String(fields.issuetype?.name || "Task"),
    priority: priorityFromJira(fields.priority?.name),
    assigneeId: fields.assignee?.accountId || "unassigned",
    assigneeName: fields.assignee?.displayName || "Unassigned",
    assigneeAvatarUrl:
      fields.assignee?.avatarUrls?.["48x48"] ||
      fields.assignee?.avatarUrls?.["32x32"],
    updated: fields.updated
      ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
          -Math.max(
            0,
            Math.round(
              (Date.now() - new Date(fields.updated).getTime()) / 86_400_000,
            ),
          ),
          "day",
        )
      : "recently",
    description: fromAdf(fields.description),
    comments: Array.isArray(fields.comment?.comments)
      ? fields.comment.comments.map((comment: any) => fromAdf(comment.body))
      : [],
    commentAuthors: Array.isArray(fields.comment?.comments)
      ? fields.comment.comments.map((comment: any) => {
          const name = String(
            comment.author?.displayName || "Jira contributor",
          );
          return {
            id: String(comment.author?.accountId || "jira-contributor"),
            name,
            initials: initialsFor(name),
            tone: "violet",
            avatarUrl:
              comment.author?.avatarUrls?.["48x48"] ||
              comment.author?.avatarUrls?.["32x32"],
          };
        })
      : [],
    remoteStatusName: fields.status?.name,
    sprintIds: (Array.isArray(fields.sprint)
      ? fields.sprint
      : fields.sprint
      ? [fields.sprint]
      : []
    ).map((sprint: any) => String(sprint.id)),
    points:
      typeof fields.customfield_10016 === "number"
        ? fields.customfield_10016
        : undefined,
  };
};

export const JiraWorkspace = ({
  api,
  connections,
  onConnectionsChange,
  onDisconnect,
}: {
  api: JiraApi;
  connections: JiraConnection[];
  onConnectionsChange: (connections: JiraConnection[]) => void;
  onDisconnect: (connectionId: string) => Promise<void>;
}) => {
  const [projectId, setProjectId] = useState("software");
  const [issuesByProject, setIssuesByProject] = useState<
    Record<string, JiraIssue[]>
  >(
    connections.length
      ? {}
      : {
          software: initialIssues,
          service: serviceIssues,
        },
  );
  const issues = useMemo(
    () => issuesByProject[projectId] || [],
    [issuesByProject, projectId],
  );
  const setIssues = (update: (current: JiraIssue[]) => JiraIssue[]) => {
    setIssuesByProject((current) => ({
      ...current,
      [projectId]: update(current[projectId] || []),
    }));
  };
  const [view, setView] = useState<View>("board");
  const [activeQueue, setActiveQueue] = useState<string>("all");
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
  const [activeConnectionId, setActiveConnectionId] = useState(
    connections[0]?.id || "",
  );
  const [activeCloudId, setActiveCloudId] = useState(
    connections[0]?.sites[0]?.id || "",
  );
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [boardType, setBoardType] = useState<string | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>(
    connections.length ? [] : sprintSeed,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(connections.length > 0);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [queues, setQueues] = useState<
    Array<{ id: string; label: string; count?: number }>
  >(connections.length ? [] : [...queueDefinitions]);
  const [serviceDeskId, setServiceDeskId] = useState<string | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<JiraUser[]>([]);
  const [priorities, setPriorities] = useState<string[]>([
    "High",
    "Medium",
    "Low",
  ]);
  const activeConnection =
    connections.find((connection) => connection.id === activeConnectionId) ||
    connections[0];
  const activeProject = projects.find((project) => project.key === projectId);
  const isServiceProject =
    activeProject?.projectTypeKey === "service_desk" || projectId === "service";
  const remoteEnabled = connections.length > 0;
  const selectedIssueKey = issues.find(
    (candidate) => candidate.id === selectedIssueId,
  )?.key;
  const currentPerson: Person = activeConnection
    ? {
        id: activeConnection.accountId,
        name: activeConnection.accountName,
        initials: initialsFor(activeConnection.accountName),
        tone: "amber",
        avatarUrl: activeConnection.accountAvatarUrl || undefined,
      }
    : people[0];
  const currentAssigneeId = activeConnection?.accountId || "you";
  const availablePeople: Person[] = remoteEnabled
    ? [
        {
          id: "unassigned",
          name: "Unassigned",
          initials: "—",
          tone: "violet",
        },
        ...assignableUsers.map((user) => ({
          id: user.accountId,
          name: user.displayName,
          initials: initialsFor(user.displayName),
          tone: "violet",
          avatarUrl: user.avatarUrls?.["48x48"] || user.avatarUrls?.["32x32"],
        })),
      ]
    : people;
  const issueTypes = useMemo(
    () =>
      activeProject?.issueTypes?.filter((issueType) => !issueType.subtask) ||
      [],
    [activeProject?.issueTypes],
  );

  const findBoard = useCallback(
    async (
      connectionId: string,
      cloudId: string,
      projectKey: string,
      projectId?: string,
    ) => {
      let result = await api.boards(connectionId, cloudId, projectKey);
      if (!result.values.length && projectId) {
        result = await api.boards(connectionId, cloudId, projectId);
      }
      if (!result.values.length) {
        result = await api.boards(connectionId, cloudId);
      }
      const board =
        result.values.find(
          (board) =>
            board.location?.projectKey === projectKey ||
            String(board.location?.projectId || "") === projectId,
        ) || result.values[0];
      return board ? { id: board.id.toString(), type: board.type } : null;
    },
    [api],
  );

  useEffect(() => {
    if (!issueTypes.length) {
      return;
    }
    setCreateType((current) =>
      issueTypes.some((issueType) => issueType.name === current)
        ? current
        : issueTypes[0]!.name,
    );
  }, [issueTypes]);

  const refreshIssues = useCallback(
    async (connectionId: string, cloudId: string, targetProjectId: string) => {
      if (!connectionId || !cloudId || !targetProjectId) {
        return;
      }
      const result = await api.searchIssues(
        connectionId,
        cloudId,
        `project = "${targetProjectId.replace(
          /"/g,
          '\\"',
        )}" ORDER BY Rank ASC, updated DESC`,
      );
      setIssuesByProject((current) => ({
        ...current,
        [targetProjectId]: result.issues.map(issueFromJira),
      }));
      setSyncLabel("Synced just now");
    },
    [api],
  );

  useEffect(() => {
    const connection =
      connections.find((candidate) => candidate.id === activeConnectionId) ||
      connections[0];
    const site =
      connection?.sites.find((candidate) => candidate.id === activeCloudId) ||
      connection?.sites[0];
    if (!connection || !site) {
      return;
    }
    setActiveConnectionId(connection.id);
    setActiveCloudId(site.id);
    let cancelled = false;
    setContentLoading(true);
    setBusyAction((current) => current || "workspace");
    setLoadError(null);
    setSyncLabel("Syncing…");
    void api
      .projects(connection.id, site.id)
      .then(async ({ values }) => {
        if (cancelled) {
          return;
        }
        setProjects(values);
        const software =
          values.find((project) => project.projectTypeKey !== "service_desk") ||
          values[0];
        if (software) {
          setProjectId(software.key);
          const nextBoard = await findBoard(
            connection.id,
            site.id,
            software.key,
            software.id,
          );
          if (!cancelled) {
            setBoardId(nextBoard?.id || null);
            setBoardType(nextBoard?.type || null);
            if (!nextBoard) {
              setSprints([{ id: "backlog", title: "Backlog", issueIds: [] }]);
            }
          }
          await refreshIssues(connection.id, site.id, software.key);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Jira could not be loaded.",
          );
          setSyncLabel("Sync failed");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setContentLoading(false);
          setBusyAction(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeCloudId,
    activeConnectionId,
    api,
    connections,
    findBoard,
    refreshIssues,
  ]);

  useEffect(() => {
    if (!boardId || !activeConnectionId || !activeCloudId) {
      return;
    }
    if (boardType && boardType !== "scrum") {
      setSprints([{ id: "backlog", title: "Backlog", issueIds: [] }]);
      return;
    }
    let cancelled = false;
    void api
      .sprints(activeConnectionId, activeCloudId, boardId)
      .then(({ values }) => {
        if (cancelled) {
          return;
        }
        setSprints([
          ...values
            .filter((sprint) => sprint.state !== "closed")
            .map((sprint) => ({
              id: String(sprint.id),
              title: sprint.name,
              dates:
                sprint.startDate && sprint.endDate
                  ? `${new Date(
                      sprint.startDate,
                    ).toLocaleDateString()} – ${new Date(
                      sprint.endDate,
                    ).toLocaleDateString()}`
                  : undefined,
              state: sprint.state,
              issueIds: [],
            })),
          { id: "backlog", title: "Backlog", issueIds: [] },
        ]);
      })
      .catch(() => {
        if (!cancelled) {
          setSprints([{ id: "backlog", title: "Backlog", issueIds: [] }]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeCloudId, activeConnectionId, api, boardId, boardType]);

  useEffect(() => {
    if (
      !remoteEnabled ||
      !activeConnectionId ||
      !activeCloudId ||
      !activeProject
    ) {
      return;
    }
    let cancelled = false;
    void api
      .assignableUsers(activeConnectionId, activeCloudId, projectId)
      .then((users) => {
        if (!cancelled) {
          setAssignableUsers(users.filter((user) => user.active));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAssignableUsers([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeCloudId,
    activeConnectionId,
    activeProject,
    api,
    projectId,
    remoteEnabled,
  ]);

  useEffect(() => {
    if (!remoteEnabled || !activeConnectionId || !activeCloudId) {
      return;
    }
    let cancelled = false;
    void api
      .priorities(activeConnectionId, activeCloudId)
      .then(({ values }) => {
        if (!cancelled && values.length) {
          const names = values.map((priority) => priority.name);
          setPriorities(names);
          setCreatePriority((current) =>
            names.includes(current) ? current : names[0]!,
          );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeCloudId, activeConnectionId, api, remoteEnabled]);

  useEffect(() => {
    if (!remoteEnabled || !selectedIssueKey) {
      return;
    }
    let cancelled = false;
    void api
      .issue(activeConnectionId, activeCloudId, selectedIssueKey)
      .then((remoteIssue) => {
        if (!cancelled) {
          const detailed = issueFromJira(remoteIssue);
          setIssuesByProject((current) => ({
            ...current,
            [projectId]: (current[projectId] || []).map((candidate) =>
              candidate.id === detailed.id ? detailed : candidate,
            ),
          }));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Issue details failed.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeCloudId,
    activeConnectionId,
    api,
    projectId,
    remoteEnabled,
    selectedIssueKey,
  ]);

  useEffect(() => {
    if (!isServiceProject || !activeConnectionId || !activeCloudId) {
      return;
    }
    let cancelled = false;
    setContentLoading(true);
    setBusyAction(`project:${projectId}`);
    void api
      .serviceDesks(activeConnectionId, activeCloudId)
      .then(async ({ values }) => {
        const desk =
          values.find(
            (candidate) => candidate.projectId === activeProject?.id,
          ) || values[0];
        if (!desk || cancelled) {
          return;
        }
        setServiceDeskId(desk.id);
        const result = await api.queues(
          activeConnectionId,
          activeCloudId,
          desk.id,
        );
        if (!cancelled && result.values.length) {
          const nextQueues = result.values.map((queue) => ({
            id: queue.id,
            label: queue.name,
            count: queue.issueCount,
          }));
          setQueues(nextQueues);
          setActiveQueue(nextQueues[0]!.id);
          const queueResult = await api.queueIssues(
            activeConnectionId,
            activeCloudId,
            desk.id,
            nextQueues[0]!.id,
          );
          if (!cancelled) {
            setIssuesByProject((current) => ({
              ...current,
              [projectId]: queueResult.values.map(issueFromJira),
            }));
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Service queues could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setContentLoading(false);
          setBusyAction(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeCloudId,
    activeConnectionId,
    activeProject?.id,
    api,
    isServiceProject,
    projectId,
  ]);

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
      if (filter === "mine" && issue.assigneeId !== currentAssigneeId) {
        return false;
      }
      return (
        !normalizedSearch ||
        issue.key.toLocaleLowerCase().includes(normalizedSearch) ||
        issue.title.toLocaleLowerCase().includes(normalizedSearch) ||
        issue.type.toLocaleLowerCase().includes(normalizedSearch)
      );
    });
  }, [currentAssigneeId, filter, issues, search]);

  const queueIssues = useMemo(() => {
    const openIssues = visibleIssues.filter((issue) => issue.status !== "done");
    if (activeQueue === "mine") {
      return openIssues.filter(
        (issue) => issue.assigneeId === currentAssigneeId,
      );
    }
    if (activeQueue === "urgent") {
      return openIssues.filter((issue) => issue.priority === "High");
    }
    return openIssues;
  }, [activeQueue, currentAssigneeId, visibleIssues]);

  const queueCount = (queueId: string) => {
    const remoteQueue = queues.find((queue) => queue.id === queueId);
    if (serviceDeskId && remoteQueue) {
      return remoteQueue.count ?? (queueId === activeQueue ? issues.length : 0);
    }
    const openIssues = visibleIssues.filter((issue) => issue.status !== "done");
    if (queueId === "mine") {
      return openIssues.filter(
        (issue) => issue.assigneeId === currentAssigneeId,
      ).length;
    }
    if (queueId === "urgent") {
      return openIssues.filter((issue) => issue.priority === "High").length;
    }
    return openIssues.length;
  };

  const selectQueue = async (queueId: string) => {
    setActiveQueue(queueId);
    if (!serviceDeskId) {
      return;
    }
    setBusyAction(`queue:${queueId}`);
    setContentLoading(true);
    setSyncLabel("Syncing…");
    try {
      const result = await api.queueIssues(
        activeConnectionId,
        activeCloudId,
        serviceDeskId,
        queueId,
      );
      setIssuesByProject((current) => ({
        ...current,
        [projectId]: result.values.map(issueFromJira),
      }));
      setSyncLabel("Synced just now");
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Queue could not be loaded.",
      );
      setSyncLabel("Sync failed");
    } finally {
      setContentLoading(false);
      setBusyAction(null);
    }
  };

  const selectProject = async (project: JiraProject) => {
    if (project.key === projectId || busyAction) {
      setProjectMenuOpen(false);
      return;
    }
    const serviceProject = project.projectTypeKey === "service_desk";
    setBusyAction(`project:${project.key}`);
    setContentLoading(true);
    setLoadError(null);
    setProjectId(project.key);
    setView(
      serviceProject && view === "backlog"
        ? "queues"
        : !serviceProject && view === "queues"
        ? "board"
        : view,
    );
    setProjectMenuOpen(false);
    setSelectedIssueId(null);
    setSyncLabel("Syncing…");
    if (!remoteEnabled) {
      if (serviceProject) {
        setBoardId(null);
        setBoardType(null);
      }
      setSyncLabel("Local preview");
      setContentLoading(false);
      setBusyAction(null);
      return;
    }
    if (serviceProject) {
      setBoardId(null);
      setBoardType(null);
      return;
    }
    try {
      const nextBoard = await findBoard(
        activeConnectionId,
        activeCloudId,
        project.key,
        project.id,
      );
      setBoardId(nextBoard?.id || null);
      setBoardType(nextBoard?.type || null);
      await refreshIssues(activeConnectionId, activeCloudId, project.key);
    } catch (error) {
      setBoardId(null);
      setBoardType(null);
      setLoadError(
        error instanceof Error ? error.message : "Jira could not be loaded.",
      );
      setSyncLabel("Sync failed");
    } finally {
      setContentLoading(false);
      setBusyAction(null);
    }
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

  const persistIssueFields = async (
    issue: JiraIssue,
    fields: Record<string, unknown>,
  ) => {
    if (!remoteEnabled) {
      return;
    }
    try {
      await api.updateIssue(
        activeConnectionId,
        activeCloudId,
        issue.key,
        fields,
      );
      setSyncLabel("Synced just now");
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Jira update failed.",
      );
      setSyncLabel("Sync failed");
      await refreshIssues(activeConnectionId, activeCloudId, projectId);
    }
  };

  const transitionIssue = async (issue: JiraIssue, status: StatusId) => {
    const target = columns.find((column) => column.id === status)!;
    patchIssue(issue.id, { status });
    if (!remoteEnabled) {
      return;
    }
    try {
      await api.transitionIssue(
        activeConnectionId,
        activeCloudId,
        issue.key,
        target.title,
      );
      setSyncLabel("Synced just now");
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Jira transition failed.",
      );
      setSyncLabel("Sync failed");
      await refreshIssues(activeConnectionId, activeCloudId, projectId);
    }
  };

  const addIssue = async (status: StatusId) => {
    const title = draftTitle.trim();
    if (!title) {
      return;
    }
    if (!remoteEnabled) {
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
      return;
    }
    const projectKey = projectId;
    try {
      const created = await api.createIssue(activeConnectionId, activeCloudId, {
        project: { key: projectKey },
        summary: title,
        issuetype: { name: "Task" },
        priority: { name: "Medium" },
      });
      if (status !== "todo") {
        await api.transitionIssue(
          activeConnectionId,
          activeCloudId,
          created.key,
          columns.find((column) => column.id === status)!.title,
        );
      }
      setDraftTitle("");
      setComposerStatus(null);
      await refreshIssues(activeConnectionId, activeCloudId, projectId);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Jira issue creation failed.",
      );
    }
  };

  const createIssue = async () => {
    const title = createTitle.trim();
    if (!title) {
      return;
    }
    if (!remoteEnabled) {
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
      setCreateType(issueTypes[0]?.name || "Task");
      setCreatePriority(priorities[0] || "Medium");
      setCreateOpen(false);
      setSelectedIssueId(issue.id);
      return;
    }
    const projectKey = projectId;
    try {
      const created = await api.createIssue(activeConnectionId, activeCloudId, {
        project: { key: projectKey },
        summary: title,
        issuetype: { name: createType },
        priority: { name: createPriority },
      });
      setCreateTitle("");
      setCreateType(issueTypes[0]?.name || "Task");
      setCreatePriority(priorities[0] || "Medium");
      setCreateOpen(false);
      await refreshIssues(activeConnectionId, activeCloudId, projectId);
      setSelectedIssueId(created.id);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Jira issue creation failed.",
      );
    }
  };

  const syncNow = async () => {
    if (busyAction) {
      return;
    }
    setBusyAction("sync");
    setContentLoading(true);
    setSyncLabel("Syncing…");
    if (!remoteEnabled) {
      window.setTimeout(() => {
        setSyncLabel("Synced just now");
        setContentLoading(false);
        setBusyAction(null);
      }, 500);
      return;
    }
    try {
      await refreshIssues(activeConnectionId, activeCloudId, projectId);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Jira sync failed.",
      );
      setSyncLabel("Sync failed");
    } finally {
      setContentLoading(false);
      setBusyAction(null);
    }
  };

  const changeSprintState = async (
    sprint: Sprint,
    state: "active" | "closed",
  ) => {
    if (!remoteEnabled || sprint.id === "backlog") {
      return;
    }
    try {
      await api.updateSprint(
        activeConnectionId,
        activeCloudId,
        sprint.id,
        state,
      );
      setSprints((current) =>
        state === "closed"
          ? current.filter((candidate) => candidate.id !== sprint.id)
          : current.map((candidate) =>
              candidate.id === sprint.id
                ? { ...candidate, state: "active" }
                : candidate,
            ),
      );
      setSyncLabel("Synced just now");
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Sprint update failed.",
      );
      setSyncLabel("Sync failed");
    }
  };

  const renderCard = (issue: JiraIssue) => {
    const assignee = personForIssue(issue);
    return (
      <article
        className={`jira-issue-card jira-issue-card--${visualToken(
          issue.type,
        )}`}
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
            className={`jira-issue-type jira-issue-type--${visualToken(
              issue.type,
            )}`}
          >
            {issue.type === "Bug" ? "✳" : "▣"} {issue.type}
          </span>
          <span
            className={`jira-priority jira-priority--${visualToken(
              issue.priority,
            )}`}
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
      title={loadError || undefined}
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
            className={`${accountMenuOpen ? "is-active" : ""} ${
              busyAction === "account" || busyAction === "disconnect"
                ? "is-loading"
                : ""
            }`}
            aria-label="Jira account"
            aria-expanded={accountMenuOpen}
            aria-busy={busyAction === "account" || busyAction === "disconnect"}
            onClick={() => {
              setAccountMenuOpen((open) => !open);
              setProjectMenuOpen(false);
            }}
          >
            <Avatar person={currentPerson} />
          </button>
          {accountMenuOpen && (
            <div className="jira-menu jira-account-menu" role="menu">
              <div className="jira-account-summary">
                <Avatar person={currentPerson} />
                <span>
                  <strong>
                    {activeConnection?.accountName || "Jira account"}
                  </strong>
                  <small>
                    {activeConnection?.accountEmail ||
                      activeConnection?.accountId}
                  </small>
                </span>
                <b>Connected</b>
              </div>
              <div className="jira-menu-divider" />
              <button
                type="button"
                onClick={() => {
                  window.open(
                    "https://id.atlassian.com/manage-profile/profile-and-visibility",
                    "_blank",
                    "noopener,noreferrer",
                  );
                }}
              >
                <span className="jira-menu-glyph">
                  <Icon name="user" />
                </span>
                <span>
                  <strong>Account details</strong>
                  <small>Atlassian contributor account</small>
                </span>
              </button>
              <button
                type="button"
                disabled={busyAction !== null}
                aria-busy={busyAction === "account"}
                onClick={() => {
                  setBusyAction("account");
                  setContentLoading(true);
                  const currentIndex = connections.findIndex(
                    (connection) => connection.id === activeConnectionId,
                  );
                  const next =
                    connections[(currentIndex + 1) % connections.length];
                  if (connections.length > 1 && next) {
                    setActiveConnectionId(next.id);
                    setActiveCloudId(next.sites[0]?.id || "");
                    setAccountMenuOpen(false);
                    return;
                  }
                  void api
                    .connect()
                    .then((nextConnections) => {
                      onConnectionsChange(nextConnections);
                      const newest = nextConnections[0];
                      if (newest) {
                        setActiveConnectionId(newest.id);
                        setActiveCloudId(newest.sites[0]?.id || "");
                      }
                      setAccountMenuOpen(false);
                    })
                    .catch((error) => {
                      setLoadError(
                        error instanceof Error
                          ? error.message
                          : "Jira account could not be switched.",
                      );
                      setContentLoading(false);
                      setBusyAction(null);
                    });
                }}
              >
                <span className="jira-menu-glyph">
                  <Icon name="switch" />
                </span>
                <span>
                  <strong>
                    {busyAction === "account" ? "Switching…" : "Switch account"}
                  </strong>
                  <small>Use another Jira connection</small>
                </span>
              </button>
              <div className="jira-menu-divider" />
              <button
                type="button"
                className="jira-account-disconnect"
                disabled={busyAction !== null}
                aria-busy={busyAction === "disconnect"}
                onClick={() => {
                  setBusyAction("disconnect");
                  setContentLoading(true);
                  void Promise.resolve(
                    onDisconnect(activeConnection?.id || ""),
                  ).catch((error) => {
                    setLoadError(
                      error instanceof Error
                        ? error.message
                        : "Jira could not be disconnected.",
                    );
                    setContentLoading(false);
                    setBusyAction(null);
                  });
                }}
              >
                <span className="jira-menu-glyph">
                  <Icon name="unlink" />
                </span>
                <span>
                  <strong>
                    {busyAction === "disconnect"
                      ? "Disconnecting…"
                      : "Disconnect Jira"}
                  </strong>
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
            className={`jira-project-trigger ${
              busyAction?.startsWith("project:") ? "is-loading" : ""
            }`}
            aria-expanded={projectMenuOpen}
            onClick={() => {
              setProjectMenuOpen((open) => !open);
              setAccountMenuOpen(false);
            }}
          >
            <span
              className={`jira-project-icon ${
                isServiceProject ? "jira-project-icon--service" : ""
              }`}
            >
              {activeProject?.key.slice(0, 2).toUpperCase() ||
                (isServiceProject ? "SM" : "JT")}
            </span>
            <strong>
              {activeProject?.name ||
                (isServiceProject
                  ? "Service Management"
                  : projectId === "software"
                  ? "My Software Team"
                  : "Jira project")}
            </strong>
            <Icon name="chevron" />
          </button>
          {projectMenuOpen && (
            <div className="jira-menu jira-project-menu" role="menu">
              <span className="jira-menu-label">Projects</span>
              {(projects.length
                ? projects
                : [
                    {
                      id: "software",
                      key: "software",
                      name: "My Software Team",
                      projectTypeKey: "software",
                    },
                    {
                      id: "service",
                      key: "service",
                      name: "Service Management",
                      projectTypeKey: "service_desk",
                    },
                  ]
              ).map((project) => {
                const serviceProject =
                  project.projectTypeKey === "service_desk";
                return (
                  <button
                    type="button"
                    key={project.id}
                    className={projectId === project.key ? "is-selected" : ""}
                    disabled={busyAction !== null}
                    aria-busy={busyAction === `project:${project.key}`}
                    onClick={() => void selectProject(project)}
                  >
                    <span
                      className={`jira-project-icon ${
                        serviceProject ? "jira-project-icon--service" : ""
                      }`}
                    >
                      {project.key.slice(0, 2).toUpperCase()}
                    </span>
                    <span>
                      <strong>{project.name}</strong>
                      <small>
                        {serviceProject
                          ? "Service project"
                          : "Software project"}
                      </small>
                    </span>
                    {busyAction === `project:${project.key}` ? (
                      <i className="jira-spinner" />
                    ) : (
                      projectId === project.key && <b>✓</b>
                    )}
                  </button>
                );
              })}
              {(activeConnection?.sites.length || 0) > 1 && (
                <>
                  <div className="jira-menu-divider" />
                  <span className="jira-menu-label">Jira sites</span>
                  {activeConnection!.sites.map((site) => (
                    <button
                      type="button"
                      key={site.id}
                      className={activeCloudId === site.id ? "is-selected" : ""}
                      onClick={() => {
                        setBusyAction("site");
                        setContentLoading(true);
                        setProjects([]);
                        setProjectId("");
                        setBoardId(null);
                        setBoardType(null);
                        setActiveCloudId(site.id);
                        setProjectMenuOpen(false);
                      }}
                    >
                      <span className="jira-project-icon">
                        {initialsFor(site.name)}
                      </span>
                      <span>
                        <strong>{site.name}</strong>
                        <small>{site.url}</small>
                      </span>
                      {activeCloudId === site.id && <b>✓</b>}
                    </button>
                  ))}
                </>
              )}
              <div className="jira-menu-divider" />
              <button
                type="button"
                onClick={() => {
                  void api.connect().then(onConnectionsChange);
                  setProjectMenuOpen(false);
                }}
              >
                <span className="jira-menu-glyph">＋</span>
                <span>
                  <strong>Add Jira project</strong>
                  <small>Connect another Jira account</small>
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
              view === (isServiceProject ? "queues" : "backlog")
                ? "is-active"
                : ""
            }
            onClick={() => setView(isServiceProject ? "queues" : "backlog")}
          >
            {isServiceProject ? "Queues" : "Backlog"}
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
          aria-label={syncLabel}
          title={syncLabel}
          className={`jira-sync-button ${
            busyAction === "sync" ? "is-loading" : ""
          }`}
          disabled={busyAction !== null}
          aria-busy={busyAction === "sync"}
          onClick={() => void syncNow()}
        >
          <Icon name="refresh" />
        </button>
      </header>

      {contentLoading && (
        <div
          className="jira-content-loading"
          role="status"
          aria-label="Loading Jira data"
        >
          <span className="jira-spinner jira-content-spinner" />
        </div>
      )}

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
                    const draggedIssue = issues.find(
                      (issue) => issue.id === draggedIssueId,
                    );
                    if (draggedIssue) {
                      void transitionIssue(draggedIssue, column.id);
                    }
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
          {!contentLoading && !visibleIssues.length && (
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
            const assignee = personForIssue(issue);
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
                  className={`jira-priority jira-priority--${visualToken(
                    issue.priority,
                  )}`}
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
          {!contentLoading && !visibleIssues.length && (
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
            {sprints.map((sprint) => {
              const assignedIds = new Set(
                issues
                  .filter((issue) => issue.sprintIds?.length)
                  .map((issue) => issue.id),
              );
              const sprintIssues = visibleIssues.filter((issue) =>
                sprint.id === "backlog"
                  ? sprint.issueIds.includes(issue.id) ||
                    !assignedIds.has(issue.id)
                  : sprint.issueIds.includes(issue.id) ||
                    issue.sprintIds?.includes(sprint.id),
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
                    {sprint.state === "active" && (
                      <button
                        type="button"
                        className="jira-sprint-action"
                        onClick={() => void changeSprintState(sprint, "closed")}
                      >
                        Complete sprint
                      </button>
                    )}
                    {sprint.state === "future" && (
                      <button
                        type="button"
                        className="jira-sprint-action"
                        onClick={() => void changeSprintState(sprint, "active")}
                      >
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
                    const assignee = personForIssue(issue);
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
                          className={`jira-type-mark jira-type-mark--${visualToken(
                            issue.type,
                          )}`}
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
                        <span>
                          {remoteEnabled
                            ? issue.points ?? "—"
                            : issuePoints[issue.id] || 3}
                        </span>
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
            {queues.map((queue) => (
              <button
                type="button"
                key={queue.id}
                className={activeQueue === queue.id ? "is-active" : ""}
                disabled={busyAction !== null}
                aria-busy={busyAction === `queue:${queue.id}`}
                onClick={() => void selectQueue(queue.id)}
              >
                <span>{queue.label}</span>
                {busyAction === `queue:${queue.id}` ? (
                  <i className="jira-spinner" />
                ) : (
                  <b>{queueCount(queue.id)}</b>
                )}
              </button>
            ))}
          </aside>
          <section className="jira-queue-content">
            <header>
              <div>
                <strong>
                  {queues.find((queue) => queue.id === activeQueue)?.label}
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
            {queueIssues.map((issue) => {
              const assignee = personForIssue(issue);
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
                    className={`jira-priority jira-priority--${visualToken(
                      issue.priority,
                    )}`}
                  >
                    {issue.priority}
                  </span>
                  <span>
                    <Avatar person={assignee} />
                    {assignee.name}
                  </span>
                  <span aria-label="SLA unavailable">—</span>
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
                  {activeProject?.name ||
                    (isServiceProject ? "Service Management" : "Jira project")}
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
                  {(issueTypes.length
                    ? issueTypes.map((issueType) => issueType.name)
                    : ["Task", "Bug", "Story"]
                  ).map((type) => (
                    <option key={type}>{type}</option>
                  ))}
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
                  {priorities.map((priority) => (
                    <option key={priority}>{priority}</option>
                  ))}
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
              onBlur={() => {
                void persistIssueFields(selectedIssue, {
                  summary: selectedIssue.title,
                });
              }}
            />
            <div className="jira-detail-fields">
              <label>
                Status
                <select
                  aria-label="Issue status"
                  value={selectedIssue.status}
                  onChange={(event) =>
                    void transitionIssue(
                      selectedIssue,
                      event.target.value as StatusId,
                    )
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
                  onChange={(event) => {
                    const assigneeId = event.target.value;
                    patchIssue(selectedIssue.id, { assigneeId });
                    void persistIssueFields(selectedIssue, {
                      assignee:
                        assigneeId === "unassigned"
                          ? null
                          : { accountId: assigneeId },
                    });
                  }}
                >
                  {availablePeople.map((person) => (
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
                  onChange={(event) => {
                    const priority = event.target.value as Priority;
                    patchIssue(selectedIssue.id, { priority });
                    void persistIssueFields(selectedIssue, {
                      priority: { name: priority },
                    });
                  }}
                >
                  {Array.from(
                    new Set([selectedIssue.priority, ...priorities]),
                  ).map((priority) => (
                    <option key={priority}>{priority}</option>
                  ))}
                </select>
              </label>
              <label>
                Type
                <select
                  aria-label="Issue type"
                  value={selectedIssue.type}
                  onChange={(event) => {
                    const type = event.target.value as IssueType;
                    patchIssue(selectedIssue.id, { type });
                    void persistIssueFields(selectedIssue, {
                      issuetype: { name: type },
                    });
                  }}
                >
                  {Array.from(
                    new Set([
                      selectedIssue.type,
                      ...(issueTypes.length
                        ? issueTypes.map((issueType) => issueType.name)
                        : ["Bug", "Task", "Story"]),
                    ]),
                  ).map((type) => (
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
                onBlur={() => {
                  void persistIssueFields(selectedIssue, {
                    description: toAdf(selectedIssue.description),
                  });
                }}
                placeholder="Add context, decisions, or acceptance criteria…"
              />
            </label>
            <section className="jira-detail-activity">
              <h3>Activity</h3>
              {selectedIssue.comments.length ? (
                selectedIssue.comments.map((comment, index) => {
                  const author =
                    selectedIssue.commentAuthors?.[index] || currentPerson;
                  return (
                    <article key={`${selectedIssue.id}-${index}`}>
                      <Avatar person={author} />
                      <div>
                        <strong>{author.name}</strong>
                        <p>{comment}</p>
                      </div>
                    </article>
                  );
                })
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
                    commentAuthors: [
                      ...(selectedIssue.commentAuthors || []),
                      currentPerson,
                    ],
                  });
                  setCommentDraft("");
                  if (remoteEnabled) {
                    void api
                      .addComment(
                        activeConnectionId,
                        activeCloudId,
                        selectedIssue.key,
                        body,
                      )
                      .catch((error) => {
                        setLoadError(
                          error instanceof Error
                            ? error.message
                            : "Comment could not be added.",
                        );
                        void refreshIssues(
                          activeConnectionId,
                          activeCloudId,
                          projectId,
                        );
                      });
                  }
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
