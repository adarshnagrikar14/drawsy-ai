import {
  PlusIcon,
  SloppinessArchitectIcon,
  SloppinessArtistIcon,
  SloppinessCartoonistIcon,
  TrashIcon,
} from "@excalidraw/excalidraw/components/icons";
import { THEME, applyDarkModeFilter } from "@excalidraw/excalidraw";
import { randomId } from "@excalidraw/common";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import React, { useState, useEffect, useRef } from "react";

import type { KanbanBoard } from "../data/KanbanStore";

type Props = {
  board: KanbanBoard;
  onChange: (board: KanbanBoard) => void;
};

type DraggedCard = { cardId: string; columnId: string };

const COLUMN_COLORS = ["neutral", "blue", "green", "violet"] as const;
const COLUMN_ANIMATION_MS = 240;

export const KanbanWorkspace = ({ board, onChange }: Props) => {
  const appState = useUIAppState();
  const [draftColumnId, setDraftColumnId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draggedCard, setDraggedCard] = useState<DraggedCard | null>(null);
  const [lastAddedColumnId, setLastAddedColumnId] = useState<string | null>(null);
  const [deletingColumnId, setDeletingColumnId] = useState<string | null>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleRoughnessChange = (e: Event) => {
      const roughness = (e as CustomEvent).detail;
      commit({ ...board, roughness });
    };
    const handleRadiusChange = (e: Event) => {
      const cardRadius = (e as CustomEvent).detail;
      commit({ ...board, cardRadius });
    };
    const handleLockChange = (e: Event) => {
      const isLocked = (e as CustomEvent).detail;
      commit({ ...board, isLocked });
    };
    const handleAddStatus = () => {
      if (board.isLocked) {
        return;
      }
      const newId = randomId();
      setLastAddedColumnId(newId);
      commit({
        ...board,
        columns: [
          ...board.columns,
          { id: newId, title: "New status", cardIds: [] },
        ],
      });
    };
    window.addEventListener("kanbanRoughnessChange", handleRoughnessChange);
    window.addEventListener("kanbanRadiusChange", handleRadiusChange);
    window.addEventListener("kanbanLockChange", handleLockChange);
    window.addEventListener("kanbanAddStatus", handleAddStatus);
    return () => {
      window.removeEventListener("kanbanRoughnessChange", handleRoughnessChange);
      window.removeEventListener("kanbanRadiusChange", handleRadiusChange);
      window.removeEventListener("kanbanLockChange", handleLockChange);
      window.removeEventListener("kanbanAddStatus", handleAddStatus);
    };
  }, [board]);

  useEffect(() => {
    if (
      lastAddedColumnId &&
      board.columns.length > 4 &&
      boardContainerRef.current
    ) {
      const timer = setTimeout(() => {
        if (boardContainerRef.current) {
          boardContainerRef.current.scrollTo({
            left: boardContainerRef.current.scrollWidth,
            behavior: "smooth",
          });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [lastAddedColumnId, board.columns.length]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("kanbanRoughnessUpdated", { detail: board.roughness }));
  }, [board.roughness]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("kanbanRadiusUpdated", { detail: board.cardRadius ?? 1 }));
  }, [board.cardRadius]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("kanbanLockUpdated", { detail: !!board.isLocked }));
  }, [board.isLocked]);

  const commit = (next: KanbanBoard) =>
    onChange({ ...next, updatedAt: Date.now() });

  const beginCard = (columnId = board.columns[0]?.id) => {
    if (board.isLocked) {
      return;
    }
    if (columnId) {
      setDraftColumnId(columnId);
      setDraftTitle("");
    }
  };

  const addCard = (columnId: string) => {
    if (board.isLocked) {
      return;
    }
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
    if (board.isLocked) {
      return;
    }
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
    if (board.isLocked) {
      return;
    }
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

  const addColumn = () => {
    if (board.isLocked) {
      return;
    }
    const newId = randomId();
    setLastAddedColumnId(newId);
    commit({
      ...board,
      columns: [
        ...board.columns,
        { id: newId, title: "New status", cardIds: [] },
      ],
    });
  };

  const updateColumn = (columnId: string, title: string) => {
    if (board.isLocked) {
      return;
    }
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
    if (board.isLocked || deletingColumnId) {
      return;
    }
    const column = board.columns.find((item) => item.id === columnId);
    if (!column || column.cardIds.length || board.columns.length === 1) {
      return;
    }
    setDeletingColumnId(columnId);
    window.setTimeout(() => {
      commit({
        ...board,
        columns: board.columns.filter((item) => item.id !== columnId),
      });
      setDeletingColumnId(null);
    }, COLUMN_ANIMATION_MS);
  };

  const moveCard = (targetColumnId: string, targetCardId?: string) => {
    if (board.isLocked) {
      setDraggedCard(null);
      return;
    }
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

  return (
    <section
      className={`kanban-workspace kanban-roughness-${board.roughness ?? 1} kanban-radius-${board.cardRadius ?? 1} ${board.isLocked ? "is-locked" : ""}`}
      aria-label="Kanban board"
      style={{
        backgroundColor: applyDarkModeFilter(
          appState.viewBackgroundColor,
          appState.theme === THEME.DARK,
        ),
      }}
    >
      <div
        className={`kanban-board columns-count-${board.columns.length}`}
        ref={boardContainerRef}
      >
        {board.columns.map((column, columnIndex) => {
          const visibleCardIds = column.cardIds.filter((cardId) => {
            return !!board.cards[cardId];
          });
          const isNew = column.id === lastAddedColumnId;
          const isDeleting = column.id === deletingColumnId;
          return (
            <section
              className={`kanban-column kanban-column--${
                COLUMN_COLORS[columnIndex % COLUMN_COLORS.length]
              } ${draggedCard ? "is-dragging" : ""} ${isNew ? "kanban-column--new" : ""} ${isDeleting ? "kanban-column--deleting" : ""}`}
              key={column.id}
              onDragOver={(event) => {
                if (board.isLocked) return;
                event.preventDefault();
              }}
              onDrop={() => {
                if (board.isLocked) return;
                moveCard(column.id);
              }}
            >
              <header className="kanban-column-header">
                <div className="kanban-status-pill">
                  <span className="kanban-status-dot">
                    {column.cardIds.length}
                  </span>
                  <input
                    aria-label={`Rename ${column.title}`}
                    defaultValue={column.title}
                    readOnly={board.isLocked}
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
                {column.cardIds.length === 0 && board.columns.length > 1 && !board.isLocked && (
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
                      draggable={!board.isLocked}
                      onDragStart={() => {
                        if (board.isLocked) return;
                        setDraggedCard({ cardId: card.id, columnId: column.id });
                      }}
                      onDragEnd={() => setDraggedCard(null)}
                      onDragOver={(event) => {
                        if (board.isLocked) return;
                        event.preventDefault();
                      }}
                      onDrop={(event) => {
                        if (board.isLocked) return;
                        event.stopPropagation();
                        moveCard(column.id, card.id);
                      }}
                    >
                      <div className="kanban-card-title">
                        <input
                          aria-label={`Edit ${card.title}`}
                          defaultValue={card.title}
                          readOnly={board.isLocked}
                          onBlur={(event) =>
                            updateCard(card.id, event.currentTarget.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.currentTarget.blur();
                            }
                          }}
                        />
                        {!board.isLocked && (
                          <button
                            type="button"
                            aria-label={`Delete ${card.title}`}
                            onClick={() => deleteCard(card.id)}
                          >
                            {TrashIcon}
                          </button>
                        )}
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

              {!board.isLocked && (
                draftColumnId === column.id ? (
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
                )
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
};
