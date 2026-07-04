import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

import { KanbanWorkspace } from "../components/KanbanWorkspace";

import type { KanbanBoard } from "../data/KanbanStore";

const board: KanbanBoard = {
  schemaVersion: 1,
  id: "board",
  title: "Product work",
  columns: [
    { id: "todo", title: "Not started", cardIds: ["card"] },
    { id: "done", title: "Done", cardIds: [] },
  ],
  cards: {
    card: {
      id: "card",
      title: "Refine comments",
      createdAt: 1,
      updatedAt: 1,
    },
  },
  roughness: 1,
  createdAt: 1,
  updatedAt: 1,
};

const Harness = ({ initialBoard = board }: { initialBoard?: KanbanBoard }) => {
  const [value, setValue] = useState(initialBoard);
  return (
    <KanbanWorkspace
      board={value}
      backgroundColor="#121212"
      onChange={setValue}
    />
  );
};

describe("KanbanWorkspace", () => {
  it("adds, edits, and deletes cards without a network dependency", () => {
    render(<Harness />);

    fireEvent.click(screen.getAllByText("New")[0]);
    fireEvent.change(screen.getByLabelText("Card title for Not started"), {
      target: { value: "Ship Kanban" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(screen.getByDisplayValue("Ship Kanban")).not.toBeNull();

    const title = screen.getByLabelText("Edit Ship Kanban");
    fireEvent.change(title, { target: { value: "Ship polished Kanban" } });
    fireEvent.blur(title);
    expect(screen.getByDisplayValue("Ship polished Kanban")).not.toBeNull();

    fireEvent.click(screen.getByLabelText("Delete Ship polished Kanban"));
    expect(screen.queryByDisplayValue("Ship polished Kanban")).toBeNull();
  });

  it("moves a card between status columns", () => {
    const { container } = render(<Harness />);
    const card = screen
      .getByDisplayValue("Refine comments")
      .closest("article")!;
    const columns = container.querySelectorAll<HTMLElement>(".kanban-column");

    fireEvent.dragStart(card);
    fireEvent.dragOver(columns[1]);
    fireEvent.drop(columns[1]);

    expect(columns[0].querySelector("article")).toBeNull();
    expect(columns[1].querySelector("article")).not.toBeNull();
  });

  it("searches cards and renames statuses inline", () => {
    render(<Harness />);

    fireEvent.click(screen.getByLabelText("Search cards"));
    fireEvent.change(screen.getByLabelText("Search cards"), {
      target: { value: "missing" },
    });
    expect(screen.queryByDisplayValue("Refine comments")).toBeNull();

    fireEvent.change(screen.getByLabelText("Search cards"), {
      target: { value: "refine" },
    });
    expect(screen.getByDisplayValue("Refine comments")).not.toBeNull();

    const status = screen.getByLabelText("Rename Not started");
    fireEvent.change(status, { target: { value: "Next" } });
    fireEvent.blur(status);
    expect(screen.getByDisplayValue("Next")).not.toBeNull();
  });

  it("reorders cards within a status", () => {
    const secondCard = {
      id: "second-card",
      title: "Build Kanban",
      createdAt: 2,
      updatedAt: 2,
    };
    const initialBoard: KanbanBoard = {
      ...board,
      columns: [
        { ...board.columns[0], cardIds: ["card", secondCard.id] },
        board.columns[1],
      ],
      cards: { ...board.cards, [secondCard.id]: secondCard },
    };
    const { container } = render(<Harness initialBoard={initialBoard} />);
    const firstCard = screen
      .getByDisplayValue("Refine comments")
      .closest("article")!;
    const secondCardElement = screen
      .getByDisplayValue("Build Kanban")
      .closest("article")!;

    fireEvent.dragStart(secondCardElement);
    fireEvent.dragOver(firstCard);
    fireEvent.drop(firstCard);

    const cards = container.querySelectorAll(".kanban-column article input");
    expect(cards[0]).toHaveValue("Build Kanban");
    expect(cards[1]).toHaveValue("Refine comments");
  });

  it("behaves as a workspace without dismissal controls", () => {
    render(<Harness />);
    expect(screen.queryByLabelText("Back to canvas")).toBeNull();
    expect(screen.getByText("By Status")).not.toBeNull();
    expect(screen.getByText("All Projects")).toBeDisabled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByLabelText("Kanban board")).not.toBeNull();
  });

  it("persists the selected Excalidraw sloppiness level", () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText("Cartoonist"));
    expect(screen.getByLabelText("Kanban board")).toHaveClass(
      "kanban-roughness-2",
    );
    expect(screen.getByLabelText("Cartoonist")).toHaveClass("is-selected");
  });
});
