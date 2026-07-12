import { fireEvent, render, screen } from "@testing-library/react";

import { JiraWorkspace } from "../components/JiraWorkspace";

describe("JiraWorkspace", () => {
  it("shares search and ownership filters across board and work views", () => {
    render(<JiraWorkspace onDisconnect={vi.fn()} />);

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
    render(<JiraWorkspace onDisconnect={vi.fn()} />);

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
    const { container } = render(<JiraWorkspace onDisconnect={vi.fn()} />);
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
    render(<JiraWorkspace onDisconnect={vi.fn()} />);

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
    render(<JiraWorkspace onDisconnect={vi.fn()} />);

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
    const { container } = render(<JiraWorkspace onDisconnect={onDisconnect} />);

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
});
