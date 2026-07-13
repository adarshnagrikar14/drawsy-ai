import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { JiraWorkspace } from "../components/JiraWorkspace";

import type { JiraApi } from "../data/JiraApi";

const jiraProps = {
  api: {} as JiraApi,
  connections: [],
  onConnectionsChange: vi.fn(),
  onDisconnect: vi.fn().mockResolvedValue(undefined),
};

describe("JiraWorkspace", () => {
  it("shares search and ownership filters across board and work views", () => {
    render(<JiraWorkspace {...jiraProps} />);

    expect(screen.getByPlaceholderText("Search 12 issues")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search Jira issues"), {
      target: { value: "permissions" },
    });
    expect(
      screen.getByText("Review workspace permissions"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Work" }));
    expect(screen.getByLabelText("Jira work list")).toBeInTheDocument();
    expect(
      screen.getByText("Review workspace permissions"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search Jira issues"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mine" }));
    expect(screen.getByRole("button", { name: "Mine" })).toHaveClass(
      "is-active",
    );
    expect(screen.getByText("Prepare release checklist")).toBeInTheDocument();
  });

  it("edits issue details and reflects the change in the work view", () => {
    render(<JiraWorkspace {...jiraProps} />);

    fireEvent.click(screen.getAllByText("Prepare release checklist")[0]);
    fireEvent.change(screen.getByLabelText("Issue title"), {
      target: { value: "Prepare launch checklist" },
    });
    fireEvent.change(screen.getByLabelText("Issue status"), {
      target: { value: "review" },
    });
    fireEvent.click(screen.getByLabelText("Close issue details"));
    fireEvent.click(screen.getByRole("button", { name: "Work" }));

    expect(screen.getByText("Prepare launch checklist")).toBeInTheDocument();
    expect(screen.getAllByText("In review").length).toBeGreaterThan(0);
  });

  it("moves an issue between board columns with drag and drop", () => {
    const { container } = render(<JiraWorkspace {...jiraProps} />);
    const issue = screen
      .getAllByText("Prepare release checklist")[0]
      .closest("article")!;
    const doneColumn = container.querySelector<HTMLElement>(
      ".jira-board-column--green",
    )!;

    fireEvent.dragStart(issue);
    fireEvent.dragOver(doneColumn);
    fireEvent.drop(doneColumn);

    expect(doneColumn).toHaveTextContent("Prepare release checklist");
  });

  it("uses the resource dock for backlog planning and service queues", () => {
    render(<JiraWorkspace {...jiraProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Backlog" }));
    expect(
      screen.getByLabelText("Jira backlog and sprints"),
    ).toBeInTheDocument();
    expect(screen.getByText("KAN Sprint 12")).toBeInTheDocument();
    expect(screen.getByText("KAN Sprint 13")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /My Software Team/ }));
    fireEvent.click(screen.getByText("Service Management"));
    expect(screen.getByLabelText("Jira service queues")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Queues" })).toHaveClass(
      "is-active",
    );
  });

  it("creates a session issue and opens its editable details", () => {
    render(<JiraWorkspace {...jiraProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Create issue/ }));
    fireEvent.change(screen.getByLabelText("New issue summary"), {
      target: { value: "Document contributor workflow" },
    });
    fireEvent.click(
      screen
        .getByLabelText("Create Jira issue")
        .querySelector<HTMLButtonElement>('button[type="submit"]')!,
    );

    expect(screen.getByLabelText(/Issue details:/)).toBeInTheDocument();
    expect(screen.getByLabelText("Issue title")).toHaveValue(
      "Document contributor workflow",
    );
  });

  it("keeps appearance in the dock and account tools in the profile menu", () => {
    const onDisconnect = vi.fn();
    const { container } = render(
      <JiraWorkspace {...jiraProps} onDisconnect={onDisconnect} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /My Software Team/ }));
    expect(screen.getByText("Service Management")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Service Management"));
    expect(screen.getByPlaceholderText("Search 4 issues")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "sketchy appearance" }));
    expect(container.querySelector(".jira-connected-workspace")).toHaveClass(
      "jira-roughness-sketchy",
    );

    expect(screen.queryByLabelText("Jira controls")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Jira account"));
    expect(screen.getByText("Switch account")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Disconnect Jira" }));
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it("loads connected Jira data and sends contributor transitions", async () => {
    const transitionIssue = vi.fn().mockResolvedValue(undefined);
    const api = {
      projects: vi.fn().mockResolvedValue({
        values: [
          {
            id: "10000",
            key: "KAN",
            name: "My Software Team",
            projectTypeKey: "software",
          },
        ],
      }),
      boards: vi.fn().mockResolvedValue({ values: [] }),
      searchIssues: vi.fn().mockResolvedValue({
        issues: [
          {
            id: "10001",
            key: "KAN-1",
            fields: {
              summary: "Live Jira issue",
              status: {
                name: "To Do",
                statusCategory: { key: "new" },
              },
              issuetype: { name: "Task" },
              priority: { name: "Medium" },
              assignee: { accountId: "you" },
              updated: new Date().toISOString(),
            },
          },
        ],
      }),
      issue: vi.fn().mockResolvedValue({
        id: "10001",
        key: "KAN-1",
        fields: {
          summary: "Live Jira issue",
          status: { name: "To Do", statusCategory: { key: "new" } },
          issuetype: { name: "Task" },
          priority: { name: "Medium" },
          assignee: { accountId: "account", displayName: "Jira User" },
          comment: { comments: [] },
        },
      }),
      assignableUsers: vi
        .fn()
        .mockResolvedValue([
          { accountId: "account", displayName: "Jira User", active: true },
        ]),
      priorities: vi.fn().mockResolvedValue({
        values: [{ id: "3", name: "Medium" }],
      }),
      transitionIssue,
      sprints: vi.fn().mockResolvedValue({ values: [] }),
    } as unknown as JiraApi;

    render(
      <JiraWorkspace
        {...jiraProps}
        api={api}
        connections={[
          {
            id: "account",
            accountId: "account",
            accountName: "Jira User",
            accountEmail: "jira@example.com",
            accountAvatarUrl: null,
            sites: [
              {
                id: "cloud",
                name: "Jira",
                url: "https://example.atlassian.net",
                scopes: [],
              },
            ],
          },
        ]}
      />,
    );

    expect(await screen.findByText("Live Jira issue")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Live Jira issue"));
    fireEvent.change(screen.getByLabelText("Issue status"), {
      target: { value: "progress" },
    });

    await waitFor(() =>
      expect(transitionIssue).toHaveBeenCalledWith(
        "account",
        "cloud",
        "KAN-1",
        "In progress",
      ),
    );
  });
});
