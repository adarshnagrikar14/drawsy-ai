import {
  PlusIcon,
  TrashIcon,
  searchIcon,
} from "@excalidraw/excalidraw/components/icons";
import { THEME, applyDarkModeFilter } from "@excalidraw/excalidraw";
import { randomId } from "@excalidraw/common";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import React, {
  useCallback,
  useState,
  useEffect,
  useMemo,
  useRef,
} from "react";

import type {
  KanbanBoard,
  KanbanCard,
  KanbanCanvasLink,
  KanbanColumn,
  KanbanMember,
} from "../data/KanbanStore";
import type { KanbanSyncStatus } from "../data/KanbanSync";
import type { CanvasDocumentMetadata } from "../data/WorkspaceStore";

type Props = {
  board: KanbanBoard;
  onChange: (board: KanbanBoard) => void;
  readOnly?: boolean;
  syncStatus?: KanbanSyncStatus;
  currentUserId?: string | null;
  currentUserDisplayName?: string;
  canvases?: CanvasDocumentMetadata[];
  onOpenCanvas?: (canvasId: string) => void;
};

type DraggedCard = { cardId: string; columnId: string };

const COLUMN_COLORS = ["neutral", "blue", "green", "violet"] as const;
const getColumnColor = (title: string, index: number): string => {
  switch (title) {
    case "Not started":
      return "neutral";
    case "In progress":
      return "blue";
    case "In review":
      return "violet";
    case "Done":
      return "green";
    default:
      return COLUMN_COLORS[index % COLUMN_COLORS.length];
  }
};
const sortColumns = (columns: KanbanColumn[]): KanbanColumn[] => {
  const ogOrder = ["Not started", "In progress", "Done", "In review"];
  const ogColumns: KanbanColumn[] = [];
  const customColumns: KanbanColumn[] = [];

  for (const col of columns) {
    if (ogOrder.includes(col.title)) {
      ogColumns.push(col);
    } else {
      customColumns.push(col);
    }
  }

  ogColumns.sort((a, b) => ogOrder.indexOf(a.title) - ogOrder.indexOf(b.title));
  return [...ogColumns, ...customColumns];
};
const COLUMN_ANIMATION_MS = 240;
type PriorityFilter = "all" | "none" | NonNullable<KanbanCard["priority"]>;
type CardSort = "manual" | "updated" | "priority" | "progress";

const PRIORITY_WEIGHT: Record<NonNullable<KanbanCard["priority"]>, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const formatDueDate = (dueAt: string) => {
  const dueDate = new Date(`${dueAt}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) {
    return { label: dueAt, tone: "default" } as const;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((dueDate.getTime() - today.getTime()) / 86_400_000);
  const date = dueDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(dueDate.getFullYear() !== today.getFullYear()
      ? { year: "numeric" as const }
      : {}),
  });
  const relative =
    days < 0
      ? `${Math.abs(days)}d overdue`
      : days === 0
      ? "Today"
      : days < 7
      ? `${days}d`
      : days < 42
      ? `${Math.ceil(days / 7)}w`
      : `${Math.ceil(days / 30)}m`;

  return {
    label: `${relative} · ${date}`,
    tone:
      days < 0
        ? "overdue"
        : days <= 2
        ? "urgent"
        : days <= 7
        ? "soon"
        : "default",
  } as const;
};

const memberFallbackLabel = (userId: string) =>
  `Member ${userId.slice(0, 4)}…${userId.slice(-4)}`;

const firstInitial = (label: string) =>
  label.trim().charAt(0).toLocaleUpperCase() || "U";

export const KanbanWorkspace = ({
  board,
  onChange,
  readOnly = false,
  syncStatus = "local",
  currentUserId = null,
  currentUserDisplayName = "You",
  canvases = [],
  onOpenCanvas,
}: Props) => {
  const appState = useUIAppState();
  const [draftColumnId, setDraftColumnId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draggedCard, setDraggedCard] = useState<DraggedCard | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [lastAddedColumnId, setLastAddedColumnId] = useState<string | null>(
    null,
  );
  const [deletingColumnId, setDeletingColumnId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [cardSort, setCardSort] = useState<CardSort>("manual");
  const [checklistDraft, setChecklistDraft] = useState("");
  const [canvasQuery, setCanvasQuery] = useState("");
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const members = useMemo<KanbanMember[]>(() => {
    const known = new Map(
      (board.members || []).map((member) => [member.userId, member]),
    );
    if (currentUserId && !known.has(currentUserId)) {
      known.set(currentUserId, {
        userId: currentUserId,
        role: "owner",
        membershipVersion: 1,
        invitedBy: null,
        joinedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    return [...known.values()];
  }, [board.members, currentUserId]);
  const memberById = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );
  const memberLabel = useCallback(
    (userId: string) =>
      currentUserId && userId === currentUserId
        ? currentUserDisplayName || "You"
        : memberFallbackLabel(userId),
    [currentUserDisplayName, currentUserId],
  );
  const assigneeLabelFor = useCallback(
    (card: KanbanCard) => {
      const primaryId = card.assigneeIds?.find((id) => memberById.has(id));
      if (primaryId) {
        const label = memberLabel(primaryId);
        const extra = Math.max((card.assigneeIds?.length || 1) - 1, 0);
        return extra > 0 ? `${label} +${extra}` : label;
      }
      return card.assignee || "Unassigned";
    },
    [memberById, memberLabel],
  );
  const commit = useCallback(
    (next: KanbanBoard) => {
      if (!readOnly) {
        onChange({ ...next, updatedAt: Date.now() });
      }
    },
    [onChange, readOnly],
  );

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
      window.removeEventListener(
        "kanbanRoughnessChange",
        handleRoughnessChange,
      );
      window.removeEventListener("kanbanRadiusChange", handleRadiusChange);
      window.removeEventListener("kanbanLockChange", handleLockChange);
      window.removeEventListener("kanbanAddStatus", handleAddStatus);
    };
  }, [board, commit]);

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
    window.dispatchEvent(
      new CustomEvent("kanbanRoughnessUpdated", { detail: board.roughness }),
    );
  }, [board.roughness]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("kanbanRadiusUpdated", { detail: board.cardRadius ?? 1 }),
    );
  }, [board.cardRadius]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("kanbanLockUpdated", { detail: !!board.isLocked }),
    );
  }, [board.isLocked]);

  useEffect(() => {
    if (!selectedCardId) {
      return;
    }
    const closeDetails = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedCardId(null);
      }
    };
    window.addEventListener("keydown", closeDetails);
    return () => window.removeEventListener("keydown", closeDetails);
  }, [selectedCardId]);

  useEffect(() => {
    setChecklistDraft("");
    setCanvasQuery("");
  }, [selectedCardId]);

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
          assigneeIds: currentUserId ? [currentUserId] : [],
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

  const patchCard = (cardId: string, patch: Partial<KanbanCard>) => {
    if (board.isLocked) {
      return;
    }
    const card = board.cards[cardId];
    if (!card) {
      return;
    }
    commit({
      ...board,
      cards: {
        ...board.cards,
        [cardId]: { ...card, ...patch, updatedAt: Date.now() },
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
    setSelectedCardId((selected) => (selected === cardId ? null : selected));
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
    if (
      ["Not started", "In progress", "In review", "Done"].includes(column.title)
    ) {
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
    setDragOverColumnId(null);
  };

  const autoScrollBoard = (event: React.DragEvent<HTMLDivElement>) => {
    if (!draggedCard) {
      return;
    }
    const boardElement = event.currentTarget;
    const { left, right } = boardElement.getBoundingClientRect();
    const edgeSize = 72;
    if (event.clientX < left + edgeSize) {
      boardElement.scrollBy({ left: -24 });
    } else if (event.clientX > right - edgeSize) {
      boardElement.scrollBy({ left: 24 });
    }
  };

  const handleColumnDragOver = (
    event: React.DragEvent<HTMLElement>,
    columnId: string,
  ) => {
    if (board.isLocked || !draggedCard) {
      return;
    }
    event.preventDefault();
    setDragOverColumnId(columnId);

    const cardsElement =
      event.currentTarget.querySelector<HTMLElement>(".kanban-cards");
    if (!cardsElement) {
      return;
    }
    const { top, bottom } = cardsElement.getBoundingClientRect();
    const edgeSize = 48;
    if (event.clientY < top + edgeSize) {
      cardsElement.scrollBy({ top: -20 });
    } else if (event.clientY > bottom - edgeSize) {
      cardsElement.scrollBy({ top: 20 });
    }
  };

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const visibleCardIdsFor = (cardIds: string[]) => {
    const visible = cardIds.filter((cardId) => {
      const card = board.cards[cardId];
      if (!card) {
        return false;
      }
      const matchesPriority =
        priorityFilter === "all" ||
        (priorityFilter === "none"
          ? !card.priority
          : card.priority === priorityFilter);
      const searchable = [
        card.title,
        card.assignee,
        ...(card.assigneeIds || []).map((id) => memberLabel(id)),
        card.description,
        ...(card.canvasTags ?? []),
        ...(card.canvasLinks ?? []).map((link) => link.title || link.canvasId),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return (
        matchesPriority &&
        (!normalizedSearch || searchable.includes(normalizedSearch))
      );
    });
    if (cardSort === "manual") {
      return visible;
    }
    return [...visible].sort((leftId, rightId) => {
      const left = board.cards[leftId];
      const right = board.cards[rightId];
      if (cardSort === "updated") {
        return right.updatedAt - left.updatedAt;
      }
      if (cardSort === "progress") {
        return (right.progress ?? 0) - (left.progress ?? 0);
      }
      return (
        (right.priority ? PRIORITY_WEIGHT[right.priority] : 0) -
        (left.priority ? PRIORITY_WEIGHT[left.priority] : 0)
      );
    });
  };

  const selectedCard = selectedCardId ? board.cards[selectedCardId] : null;
  const checklistTotal = selectedCard?.checklist?.length ?? 0;
  const checklistCompleted =
    selectedCard?.checklist?.filter((item) => item.completed).length ?? 0;
  const selectedCanvasIds = new Set(
    selectedCard?.canvasLinks?.map((link) => link.canvasId) || [],
  );
  const normalizedCanvasQuery = canvasQuery
    .trim()
    .replace(/^@/, "")
    .toLocaleLowerCase();
  const canvasOptions = canvases
    .filter((canvas) => !selectedCanvasIds.has(canvas.id))
    .filter(
      (canvas) =>
        !normalizedCanvasQuery ||
        canvas.title.toLocaleLowerCase().includes(normalizedCanvasQuery),
    )
    .sort((first, second) => second.lastOpenedAt - first.lastOpenedAt)
    .slice(0, 6);
  const addCanvasLink = (cardId: string, canvas: CanvasDocumentMetadata) => {
    const card = board.cards[cardId];
    if (
      !card ||
      card.canvasLinks?.some((link) => link.canvasId === canvas.id)
    ) {
      return;
    }
    const link: KanbanCanvasLink = {
      id: randomId(),
      canvasId: canvas.id,
      title: canvas.title,
      state: "available",
      createdAt: Date.now(),
    };
    patchCard(cardId, { canvasLinks: [...(card.canvasLinks || []), link] });
    setCanvasQuery("");
  };
  const hasActiveQuery =
    !!normalizedSearch || priorityFilter !== "all" || cardSort !== "manual";

  return (
    <section
      className={`kanban-workspace kanban-roughness-${
        board.roughness ?? 1
      } kanban-radius-${board.cardRadius ?? 1} ${
        board.isLocked ? "is-locked" : ""
      }`}
      aria-label="Kanban board"
      style={{
        backgroundColor: applyDarkModeFilter(
          appState.viewBackgroundColor,
          appState.theme === THEME.DARK,
        ),
      }}
    >
      <div className="kanban-viewbar">
        <div className="kanban-view-heading">
          <span className="kanban-view-icon kanban-view-icon--status" />
          <strong>By status</strong>
          <span className="kanban-project-count">
            {Object.keys(board.cards).length} projects
          </span>
          <span className="kanban-sync-status" data-status={syncStatus}>
            {syncStatus === "synced"
              ? "Saved"
              : syncStatus === "pending" || syncStatus === "syncing"
              ? "Saving…"
              : syncStatus === "offline"
              ? "Offline · saved locally"
              : syncStatus === "conflict"
              ? "Needs review"
              : syncStatus === "error"
              ? "Sync paused"
              : "Local"}
          </span>
        </div>
        <div className="kanban-actions" aria-label="Board controls">
          <label className="kanban-search">
            <span aria-hidden="true">{searchIcon}</span>
            <input
              aria-label="Search projects"
              placeholder="Search projects"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          <select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(event) =>
              setPriorityFilter(event.target.value as PriorityFilter)
            }
          >
            <option value="all">All priorities</option>
            <option value="high">High priority</option>
            <option value="medium">Medium priority</option>
            <option value="low">Low priority</option>
            <option value="none">No priority</option>
          </select>
          <select
            aria-label="Sort projects"
            value={cardSort}
            onChange={(event) => setCardSort(event.target.value as CardSort)}
          >
            <option value="manual">Manual order</option>
            <option value="updated">Recently updated</option>
            <option value="priority">Priority</option>
            <option value="progress">Progress</option>
          </select>
          {hasActiveQuery && (
            <button
              type="button"
              className="kanban-clear-controls"
              onClick={() => {
                setSearchQuery("");
                setPriorityFilter("all");
                setCardSort("manual");
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <div
        className={`kanban-board columns-count-${board.columns.length}`}
        ref={boardContainerRef}
        onDragOver={autoScrollBoard}
      >
        {sortColumns(board.columns).map((column, columnIndex) => {
          const visibleCardIds = visibleCardIdsFor(column.cardIds);
          const isNew = column.id === lastAddedColumnId;
          const isDeleting = column.id === deletingColumnId;
          const isDropTarget = column.id === dragOverColumnId;
          return (
            <section
              className={`kanban-column kanban-column--${getColumnColor(
                column.title,
                columnIndex,
              )} ${draggedCard ? "is-dragging" : ""} ${
                isDropTarget ? "is-drop-target" : ""
              } ${isNew ? "kanban-column--new" : ""} ${
                isDeleting ? "kanban-column--deleting" : ""
              }`}
              key={column.id}
              onDragOver={(event) => handleColumnDragOver(event, column.id)}
              onDrop={() => {
                if (board.isLocked) {
                  return;
                }
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
                    readOnly={
                      board.isLocked ||
                      [
                        "Not started",
                        "In progress",
                        "In review",
                        "Done",
                      ].includes(column.title)
                    }
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
                {column.cardIds.length === 0 &&
                  board.columns.length > 1 &&
                  !board.isLocked &&
                  !["Not started", "In progress", "In review", "Done"].includes(
                    column.title,
                  ) && (
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
                  const dueDate = card.dueAt ? formatDueDate(card.dueAt) : null;
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
                        if (board.isLocked) {
                          return;
                        }
                        setDraggedCard({
                          cardId: card.id,
                          columnId: column.id,
                        });
                      }}
                      onDragEnd={() => {
                        setDraggedCard(null);
                        setDragOverColumnId(null);
                      }}
                      onDragOver={(event) => {
                        if (board.isLocked) {
                          return;
                        }
                        event.preventDefault();
                      }}
                      onDrop={(event) => {
                        if (board.isLocked) {
                          return;
                        }
                        event.stopPropagation();
                        moveCard(column.id, card.id);
                      }}
                      onClick={(event) => {
                        if (
                          (event.target as HTMLElement).closest(
                            "input, button, select, a",
                          )
                        ) {
                          return;
                        }
                        setSelectedCardId(card.id);
                      }}
                    >
                      <div className="kanban-card-title">
                        <input
                          key={card.title}
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
                      {(card.priority ||
                        card.dueAt ||
                        !!card.canvasLinks?.length ||
                        !!card.canvasTags?.length) && (
                        <div className="kanban-card-meta">
                          {card.priority && (
                            <span
                              className={`kanban-priority kanban-priority--${card.priority}`}
                            >
                              {card.priority}
                            </span>
                          )}
                          {dueDate && (
                            <span
                              className={`kanban-due kanban-due--${dueDate.tone}`}
                              title={`Due ${card.dueAt}`}
                            >
                              {dueDate.label}
                            </span>
                          )}
                          {(card.canvasLinks ?? []).slice(0, 2).map((link) => (
                            <span
                              className={`kanban-canvas-tag ${
                                link.state === "restricted"
                                  ? "kanban-canvas-tag--restricted"
                                  : ""
                              }`}
                              key={link.id}
                              title={
                                link.state === "restricted"
                                  ? "Canvas unavailable for this account"
                                  : link.title || link.canvasId
                              }
                            >
                              @{link.title || "Restricted"}
                            </span>
                          ))}
                          {!card.canvasLinks?.length &&
                            (card.canvasTags ?? []).slice(0, 2).map((tag) => (
                              <span
                                className="kanban-canvas-tag kanban-canvas-tag--legacy"
                                key={tag}
                              >
                                @{tag}
                              </span>
                            ))}
                        </div>
                      )}
                      <div className="kanban-card-footer">
                        <div className="kanban-card-person">
                          <span>{firstInitial(assigneeLabelFor(card))}</span>
                          <b>{assigneeLabelFor(card)}</b>
                        </div>
                        <div className="kanban-card-progress">
                          <i>
                            <b style={{ width: `${progress}%` }} />
                          </i>
                          <span>{progress}%</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {visibleCardIds.length === 0 && column.cardIds.length > 0 && (
                <div className="kanban-empty-filter">No matching projects</div>
              )}

              {!board.isLocked &&
                (draftColumnId === column.id ? (
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
                  </form>
                ) : (
                  <button
                    type="button"
                    className="kanban-add-card"
                    onClick={() => beginCard(column.id)}
                  >
                    {PlusIcon} New project
                  </button>
                ))}
            </section>
          );
        })}
      </div>
      {selectedCard && (
        <aside
          className="kanban-detail"
          aria-label={`Project details: ${selectedCard.title}`}
        >
          <header>
            <div>
              <span>Project</span>
              <input
                className="kanban-detail-title-input"
                aria-label="Project title"
                value={selectedCard.title}
                readOnly={board.isLocked}
                onChange={(event) =>
                  patchCard(selectedCard.id, { title: event.target.value })
                }
              />
            </div>
            <button
              type="button"
              aria-label="Close project details"
              onClick={() => setSelectedCardId(null)}
            >
              ×
            </button>
          </header>
          <div className="kanban-detail-scroll">
            <div className="kanban-detail-grid">
              <label>
                <span>Assignee</span>
                <select
                  value={selectedCard.assigneeIds?.[0] || ""}
                  disabled={board.isLocked || members.length === 0}
                  onChange={(event) =>
                    patchCard(selectedCard.id, {
                      assigneeIds: event.target.value
                        ? [event.target.value]
                        : [],
                      assignee: undefined,
                    })
                  }
                >
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {memberLabel(member.userId)}
                      {member.role === "owner" ? " · owner" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Priority</span>
                <select
                  value={selectedCard.priority ?? ""}
                  disabled={board.isLocked}
                  onChange={(event) =>
                    patchCard(selectedCard.id, {
                      priority: (event.target.value ||
                        null) as KanbanCard["priority"],
                    })
                  }
                >
                  <option value="">None</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label>
                <span>Progress</span>
                <div className="kanban-progress-input">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={selectedCard.progress ?? 0}
                    style={
                      {
                        "--kanban-progress": `${selectedCard.progress ?? 0}%`,
                      } as React.CSSProperties
                    }
                    disabled={board.isLocked}
                    onChange={(event) =>
                      patchCard(selectedCard.id, {
                        progress: Number(event.target.value),
                      })
                    }
                  />
                  <output>{selectedCard.progress ?? 0}%</output>
                </div>
              </label>
              <label>
                <span>Due date</span>
                <input
                  type="date"
                  value={selectedCard.dueAt ?? ""}
                  readOnly={board.isLocked}
                  onChange={(event) =>
                    patchCard(selectedCard.id, {
                      dueAt: event.target.value || null,
                    })
                  }
                />
              </label>
            </div>
            <label>
              <span>Description</span>
              <textarea
                rows={3}
                value={selectedCard.description ?? ""}
                placeholder="Add context, decisions, or acceptance notes…"
                readOnly={board.isLocked}
                onChange={(event) =>
                  patchCard(selectedCard.id, {
                    description: event.target.value,
                  })
                }
              />
            </label>
            <section className="kanban-detail-section">
              <div className="kanban-detail-section-title">
                <div>
                  <strong>Canvas links</strong>
                  <span>Search your real canvases and attach context</span>
                </div>
              </div>
              <div className="kanban-tag-editor">
                {(selectedCard.canvasLinks ?? []).map((link) => (
                  <span
                    className={`kanban-linked-canvas ${
                      link.state === "restricted"
                        ? "kanban-linked-canvas--restricted"
                        : ""
                    }`}
                    key={link.id}
                  >
                    <button
                      type="button"
                      className="kanban-linked-canvas-open"
                      disabled={link.state !== "available" || !onOpenCanvas}
                      title={
                        link.state === "available"
                          ? `Open ${link.title || "canvas"}`
                          : "Canvas unavailable for this account"
                      }
                      onClick={() => onOpenCanvas?.(link.canvasId)}
                    >
                      <span className="kanban-tag-name">
                        @{link.title || "Restricted canvas"}
                      </span>
                    </button>
                    {!board.isLocked && (
                      <button
                        type="button"
                        className="kanban-linked-canvas-remove"
                        aria-label={`Remove canvas link ${
                          link.title || link.canvasId
                        }`}
                        onClick={() =>
                          patchCard(selectedCard.id, {
                            canvasLinks: selectedCard.canvasLinks?.filter(
                              (item) => item.id !== link.id,
                            ),
                          })
                        }
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {(selectedCard.canvasTags ?? []).map((tag) => (
                  <span
                    className="kanban-linked-canvas kanban-linked-canvas--legacy"
                    key={tag}
                  >
                    <span className="kanban-tag-name">@{tag}</span>
                    {!board.isLocked && (
                      <button
                        type="button"
                        className="kanban-linked-canvas-remove"
                        aria-label={`Remove legacy canvas tag ${tag}`}
                        onClick={() =>
                          patchCard(selectedCard.id, {
                            canvasTags: selectedCard.canvasTags?.filter(
                              (item) => item !== tag,
                            ),
                          })
                        }
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {!board.isLocked && (
                  <div className="kanban-canvas-picker">
                    <input
                      aria-label="Search canvases to link"
                      placeholder={
                        canvases.length
                          ? "@canvas name"
                          : "No canvases in this workspace"
                      }
                      value={canvasQuery}
                      disabled={canvases.length === 0}
                      onChange={(event) => setCanvasQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") {
                          return;
                        }
                        event.preventDefault();
                        const [first] = canvasOptions;
                        if (first) {
                          addCanvasLink(selectedCard.id, first);
                        }
                      }}
                    />
                    {canvasQuery.trim() && (
                      <div className="kanban-canvas-options">
                        {canvasOptions.length ? (
                          canvasOptions.map((canvas) => (
                            <button
                              type="button"
                              key={canvas.id}
                              onClick={() =>
                                addCanvasLink(selectedCard.id, canvas)
                              }
                            >
                              <span>@{canvas.title}</span>
                            </button>
                          ))
                        ) : (
                          <span>No matching canvas</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
            <section className="kanban-detail-section">
              <div className="kanban-detail-section-title">
                <div>
                  <strong>Checklist</strong>
                  <span>Completion steps</span>
                </div>
                <span className="kanban-checklist-count">
                  {checklistCompleted} of {checklistTotal}
                </span>
              </div>
              <div className="kanban-checklist">
                {(selectedCard.checklist ?? []).map((item) => (
                  <div className="kanban-checklist-item" key={item.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={item.completed}
                        disabled={board.isLocked}
                        onChange={() =>
                          patchCard(selectedCard.id, {
                            checklist: selectedCard.checklist?.map((entry) =>
                              entry.id === item.id
                                ? { ...entry, completed: !entry.completed }
                                : entry,
                            ),
                          })
                        }
                      />
                      <span>{item.title}</span>
                    </label>
                    {!board.isLocked && (
                      <button
                        type="button"
                        aria-label={`Delete checklist item ${item.title}`}
                        onClick={() =>
                          patchCard(selectedCard.id, {
                            checklist: selectedCard.checklist?.filter(
                              (entry) => entry.id !== item.id,
                            ),
                          })
                        }
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {!board.isLocked && (
                  <form
                    className="kanban-checklist-add"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const title = checklistDraft.trim();
                      if (!title) {
                        return;
                      }
                      patchCard(selectedCard.id, {
                        checklist: [
                          ...(selectedCard.checklist ?? []),
                          { id: randomId(), title, completed: false },
                        ],
                      });
                      setChecklistDraft("");
                    }}
                  >
                    <span
                      className="kanban-checklist-add-box"
                      aria-hidden="true"
                    />
                    <input
                      aria-label="Add checklist item"
                      placeholder="Add a step…"
                      value={checklistDraft}
                      onChange={(event) =>
                        setChecklistDraft(event.target.value)
                      }
                    />
                  </form>
                )}
              </div>
            </section>
          </div>
        </aside>
      )}
    </section>
  );
};
