import { render, screen } from "@testing-library/react";

import { JiraWorkspacePlaceholder } from "../components/JiraWorkspacePlaceholder";

describe("JiraWorkspacePlaceholder", () => {
  it("renders a distinct local Jira contributor placeholder", () => {
    render(<JiraWorkspacePlaceholder />);

    expect(screen.getByLabelText("Jira Workspace")).toBeInTheDocument();
    expect(screen.getByText("Bring Jira into Drawsy")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Jira" })).toBeEnabled();
  });
});
