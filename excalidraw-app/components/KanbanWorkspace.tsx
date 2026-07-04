import {
  PlusIcon,
  searchIcon,
  SloppinessArchitectIcon,
  SloppinessArtistIcon,
  SloppinessCartoonistIcon,
  TrashIcon,
} from "@excalidraw/excalidraw/components/icons";
import { randomId } from "@excalidraw/common";
import React, { useState } from "react";

import type { KanbanBoard } from "../data/KanbanStore";

type Props = {
  board: KanbanBoard;
  backgroundColor: string;
  onChange: (board: KanbanBoard) => void;
};

type DraggedCard = { cardId: string; columnId: string };

const COLUMN_COLORS = ["neutral", "blue", "green", "violet"] as const;

const ViewIcon = ({ type }: { type: "status" | "star" | "gantt" | "user" }) => (
  <span
    className={`kanban-view-icon kanban-view-icon--${type}`}
    aria-hidden="true"
  />
);

const ActionIcon = ({ type }: { type: string }) => (
  <span
    className={`kanban-action-icon kanban-action-icon--${type}`}
    aria-hidden="true"
  />
);

export const KanbanWorkspace = ({
  board,
  backgroundColor,
  onChange,
}: Props) => {
  const [draftColumnId, setDraftColumnId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draggedCard, setDraggedCard] = useState<DraggedCard | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const commit = (next: KanbanBoard) =>
    onChange({ ...next, updatedAt: Date.now() });

  const beginCard = (columnId = board.columns[0]?.id) => {
    if (columnId) {
      setDraftColumnId(columnId);
      setDraftTitle("");
    }
  };

  const addCard = (columnId: string) => {
    const title = draftTitle.trim();
    if (!title) {
      return;
    }
    const id = randomId();
    const now = Date.now();
    commit({
      ...board,
      cards: {
        ...board.cards,
        [id]: {
          id,
          title,
          assignee: "You",
          progress: 0,
          priority: null,
          createdAt: now,
          updatedAt: now,
        },
      },
      columns: board.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column,
      ),
    });
    setDraftTitle("");
    setDraftColumnId(null);
  };

  const updateCard = (cardId: string, title: string) => {
    const card = board.cards[cardId];
    const nextTitle = title.trim();
    if (!card || !nextTitle || nextTitle === card.title) {
      return;
    }
    commit({
      ...board,
      cards: {
        ...board.cards,
        [cardId]: { ...card, title: nextTitle, updatedAt: Date.now() },
      },
    });
  };

  const deleteCard = (cardId: string) => {
    const { [cardId]: _deletedCard, ...cards } = board.cards;
    commit({
      ...board,
      cards,
      columns: board.columns.map((column) => ({
        ...column,
        cardIds: column.cardIds.filter((id) => id !== cardId),
      })),
    });
  };

  const addColumn = () =>
    commit({
      ...board,
      columns: [
        ...board.columns,
        { id: randomId(), title: "New status", cardIds: [] },
      ],
    });

  const updateColumn = (columnId: string, title: string) => {
    const nextTitle = title.trim();
    if (!nextTitle) {
      return;
    }
    commit({
      ...board,
      columns: board.columns.map((column) =>
        column.id === columnId ? { ...column, title: nextTitle } : column,
      ),
    });
  };

  const deleteEmptyColumn = (columnId: string) => {
    const column = board.columns.find((item) => item.id === columnId);
    if (!column || column.cardIds.length || board.columns.length === 1) {
      return;
    }
    commit({
      ...board,
      columns: board.columns.filter((item) => item.id !== columnId),
    });
  };

  const moveCard = (targetColumnId: string, targetCardId?: string) => {
    if (!draggedCard || targetCardId === draggedCard.cardId) {
      setDraggedCard(null);
      return;
    }
    const nextColumns = board.columns.map((column) => ({
      ...column,
      cardIds: column.cardIds.filter((id) => id !== draggedCard.cardId),
    }));
    const targetColumn = nextColumns.find(
      (column) => column.id === targetColumnId,
    );
    if (!targetColumn) {
      setDraggedCard(null);
      return;
    }
    const targetIndex = targetCardId
      ? targetColumn.cardIds.indexOf(targetCardId)
      : targetColumn.cardIds.length;
    targetColumn.cardIds.splice(
      targetIndex < 0 ? targetColumn.cardIds.length : targetIndex,
      0,
      draggedCard.cardId,
    );
    commit({ ...board, columns: nextColumns });
    setDraggedCard(null);
  };

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();

  return (
    <section
      className={`kanban-workspace kanban-roughness-${board.roughness ?? 1}`}
      aria-label="Kanban board"
      style={{ backgroundColor }}
    >
      <div className="kanban-sloppiness-control" aria-label="Sloppiness">
        {(
          [
            [0, "Architect", SloppinessArchitectIcon],
            [1, "Artist", SloppinessArtistIcon],
            [2, "Cartoonist", SloppinessCartoonistIcon],
          ] as const
        ).map(([roughness, label, icon]) => (
          <button
            key={roughness}
            type="button"
            className={board.roughness === roughness ? "is-selected" : ""}
            aria-label={label}
            title={label}
            onClick={() => commit({ ...board, roughness })}
          >
            {icon}
          </button>
        ))}
      </div>
      <header className="kanban-viewbar">
        <nav className="kanban-views" aria-label="Kanban views">
          <button type="button" className="is-active">
            <ViewIcon type="status" /> By Status
          </button>
          <button type="button" disabled>
            <ViewIcon type="star" /> All Projects
          </button>
          <button type="button" disabled>
            <ViewIcon type="gantt" /> Gantt
          </button>
          <button type="button" disabled>
            <ViewIcon type="user" /> My Projects
          </button>
        </nav>
        <div className="kanban-actions" aria-label="Board actions">
          {(["filter", "sort", "bolt", "spark"] as const).map((type) => (
            <button key={type} type="button" disabled aria-label={type}>
              <ActionIcon type={type} />
            </button>
          ))}
          {searchOpen ? (
            <input
              autoFocus
              aria-label="Search cards"
              placeholder="Search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearchOpen(false);
                  setSearchQuery("");
                }
              }}
            />
          ) : (
            <button
              type="button"
              aria-label="Search cards"
              onClick={() => setSearchOpen(true)}
            >
              {searchIcon}
            </button>
          )}
          <button type="button" disabled aria-label="Properties">
            <ActionIcon type="sliders" />
          </button>
          <button
            type="button"
            className="kanban-new"
            onClick={() => beginCard()}
          >
            New
          </button>
        </div>
      </header>

      <div className="kanban-board">
        {board.columns.map((column, columnIndex) => {
          const visibleCardIds = column.cardIds.filter((cardId) => {
            const card = board.cards[cardId];
            return (
              card &&
              (!normalizedSearch ||
                card.title.toLocaleLowerCase().includes(normalizedSearch))
            );
          });
          return (
            <section
              className={`kanban-column kanban-column--${
                COLUMN_COLORS[columnIndex % COLUMN_COLORS.length]
              } ${draggedCard ? "is-dragging" : ""}`}
              key={column.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => moveCard(column.id)}
            >
              <header className="kanban-column-header">
                <div className="kanban-status-pill">
                  <span className="kanban-status-dot" />
                  <input
                    aria-label={`Rename ${column.title}`}
                    defaultValue={column.title}
                    onBlur={(event) =>
                      updateColumn(column.id, event.currentTarget.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                    }}
                  />
                </div>
                <span className="kanban-column-count">
                  {column.cardIds.length}
                </span>
                {column.cardIds.length === 0 && board.columns.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Delete ${column.title}`}
                    onClick={() => deleteEmptyColumn(column.id)}
                  >
                    {TrashIcon}
                  </button>
                )}
              </header>

              <div className="kanban-cards">
                {visibleCardIds.map((cardId) => {
                  const card = board.cards[cardId];
                  const progress = Math.max(
                    0,
                    Math.min(100, card.progress || 0),
                  );
                  return (
                    <article
                      className="kanban-card"
                      key={card.id}
                      draggable
                      onDragStart={() =>
                        setDraggedCard({ cardId: card.id, columnId: column.id })
                      }
                      onDragEnd={() => setDraggedCard(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.stopPropagation();
                        moveCard(column.id, card.id);
                      }}
                    >
                      <div className="kanban-card-title">
                        <input
                          aria-label={`Edit ${card.title}`}
                          defaultValue={card.title}
                          onBlur={(event) =>
                            updateCard(card.id, event.currentTarget.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.currentTarget.blur();
                            }
                          }}
                        />
                        <button
                          type="button"
                          aria-label={`Delete ${card.title}`}
                          onClick={() => deleteCard(card.id)}
                        >
                          {TrashIcon}
                        </button>
                      </div>
                      <div className="kanban-card-person">
                        <span>{(card.assignee || "You").charAt(0)}</span>
                        {card.assignee || "You"}
                      </div>
                      <div className="kanban-card-progress">
                        <span>{progress}%</span>
                        <i>
                          <b style={{ width: `${progress}%` }} />
                        </i>
                      </div>
                    </article>
                  );
                })}
              </div>

              {draftColumnId === column.id ? (
                <form
                  className="kanban-card-composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addCard(column.id);
                  }}
                >
                  <input
                    autoFocus
                    aria-label={`Card title for ${column.title}`}
                    placeholder="New project"
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setDraftColumnId(null);
                        setDraftTitle("");
                      }
                    }}
                  />
                  <button type="submit" disabled={!draftTitle.trim()}>
                    Add
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="kanban-add-card"
                  onClick={() => beginCard(column.id)}
                >
                  {PlusIcon} New project
                </button>
              )}
            </section>
          );
        })}
        <button type="button" className="kanban-add-group" onClick={addColumn}>
          {PlusIcon} Add status
        </button>
      </div>
    </section>
  );
};
