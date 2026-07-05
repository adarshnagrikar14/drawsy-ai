import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { useState } from "react";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { UIAppStateContext } from "@excalidraw/excalidraw/context/ui-appState";

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
    <UIAppStateContext.Provider
      value={{
        ...getDefaultAppState(),
        width: 1000,
        height: 800,
        offsetLeft: 0,
        offsetTop: 0,
      }}
    >
      <KanbanWorkspace board={value} onChange={setValue} />
    </UIAppStateContext.Provider>
  );
};

describe("KanbanWorkspace", () => {
  it("adds, edits, and deletes cards without a network dependency", () => {
    render(<Harness />);

    fireEvent.click(screen.getAllByText("New project")[0]);
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

  it("renames statuses inline", () => {
    render(<Harness />);

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
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByLabelText("Kanban board")).not.toBeNull();
  });

  it("persists the selected Excalidraw sloppiness level", () => {
    const handleRoughnessUpdated = vi.fn();
    window.addEventListener("kanbanRoughnessUpdated", handleRoughnessUpdated);

    render(<Harness />);

    // Initial dispatch of roughness 1 on mount
    expect(handleRoughnessUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 1 }),
    );

    // Simulate change from top dock
    fireEvent(window, new CustomEvent("kanbanRoughnessChange", { detail: 2 }));

    expect(screen.getByLabelText("Kanban board")).toHaveClass(
      "kanban-roughness-2",
    );

    window.removeEventListener(
      "kanbanRoughnessUpdated",
      handleRoughnessUpdated,
    );
  });

  it("persists the selected Kanban card radius level", () => {
    const handleRadiusUpdated = vi.fn();
    window.addEventListener("kanbanRadiusUpdated", handleRadiusUpdated);

    render(<Harness />);

    expect(handleRadiusUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 1 }),
    );

    fireEvent(window, new CustomEvent("kanbanRadiusChange", { detail: 2 }));

    expect(screen.getByLabelText("Kanban board")).toHaveClass(
      "kanban-radius-2",
    );

    window.removeEventListener("kanbanRadiusUpdated", handleRadiusUpdated);
  });

  it("enforces lock state disabling card dragging and editing", () => {
    const handleLockUpdated = vi.fn();
    window.addEventListener("kanbanLockUpdated", handleLockUpdated);

    const { container } = render(<Harness />);

    expect(handleLockUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ detail: false }),
    );

    fireEvent(window, new CustomEvent("kanbanLockChange", { detail: true }));

    expect(screen.getByLabelText("Kanban board")).toHaveClass("is-locked");

    const inputs = container.querySelectorAll("article.kanban-card input");
    expect(inputs[0]).toHaveAttribute("readonly");

    window.removeEventListener("kanbanLockUpdated", handleLockUpdated);
  });

  it("adds a new status when kanbanAddStatus event is dispatched", () => {
    const { container } = render(<Harness />);
    expect(container.querySelectorAll(".kanban-column").length).toBe(2);

    fireEvent(window, new CustomEvent("kanbanAddStatus"));

    expect(container.querySelectorAll(".kanban-column").length).toBe(3);
  });

  it("animates an empty status before deleting it", () => {
    vi.useFakeTimers();
    const { container } = render(<Harness />);

    fireEvent.click(screen.getByLabelText("Delete Done"));

    expect(
      screen.getByLabelText("Rename Done").closest(".kanban-column"),
    ).toHaveClass("kanban-column--deleting");
    expect(container.querySelectorAll(".kanban-column").length).toBe(2);

    act(() => vi.advanceTimersByTime(240));
    expect(container.querySelectorAll(".kanban-column").length).toBe(1);
    vi.useRealTimers();
  });

  it("searches and filters cards without changing the board", () => {
    const secondCard = {
      id: "urgent-card",
      title: "Ship release",
      priority: "high" as const,
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
    render(<Harness initialBoard={initialBoard} />);

    fireEvent.change(screen.getByLabelText("Search projects"), {
      target: { value: "release" },
    });
    expect(screen.queryByDisplayValue("Refine comments")).toBeNull();
    expect(screen.getByDisplayValue("Ship release")).not.toBeNull();

    fireEvent.click(screen.getByText("Clear"));
    fireEvent.change(screen.getByLabelText("Filter by priority"), {
      target: { value: "none" },
    });
    expect(screen.getByDisplayValue("Refine comments")).not.toBeNull();
    expect(screen.queryByDisplayValue("Ship release")).toBeNull();
  });

  it("edits project details and links canvas context", () => {
    render(<Harness />);
    fireEvent.click(
      screen.getByDisplayValue("Refine comments").closest("article")!,
    );

    expect(
      screen.getByLabelText("Project details: Refine comments"),
    ).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Priority"), {
      target: { value: "high" },
    });
    fireEvent.change(screen.getByLabelText("Progress"), {
      target: { value: "60" },
    });
    fireEvent.change(screen.getByLabelText("Add canvas link"), {
      target: { value: "@canvas1" },
    });
    fireEvent.keyDown(screen.getByLabelText("Add canvas link"), {
      key: "Enter",
    });
    fireEvent.change(screen.getByLabelText("Add checklist item"), {
      target: { value: "Review prototype" },
    });
    fireEvent.submit(screen.getByLabelText("Add checklist item").closest("form")!);

    expect(screen.getAllByText("@canvas1").length).toBeGreaterThan(0);
    expect(screen.getByText("Review prototype")).not.toBeNull();
    expect(screen.getAllByText("60%").length).toBeGreaterThan(0);
    expect(screen.getByText("high")).not.toBeNull();
  });
});
