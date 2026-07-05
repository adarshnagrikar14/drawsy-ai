# Notion Kanban Observation and Drawsy Adaptation

Date: 2026-07-05

## Scope and Method

This note is based on direct inspection of the open authenticated Notion page `Raw Matt | By Status`. The inspection stayed inside this project database and its four configured views. It covered visible board behavior, view settings, menus, cards, detail panes, filters, sorting, grouping, property configuration, timeline behavior, and long-board scrolling.

No project records were intentionally created, edited, moved, or deleted. One empty advanced-filter rule was opened during inspection and immediately removed; the board was returned to the original `By Status` view with no active menu.

Statements labeled **Observed** are confirmed from this board. Statements labeled **Recommended for Drawsy** are product decisions derived from the observation and the current `excal-ai` architecture.

## Executive Product Observation

Notion's Kanban is not a separate task system. It is one projection of a typed database. The same project records appear as:

- a status-grouped board,
- a complete editable table,
- a date-based Gantt/timeline,
- and a filtered `My Projects` table.

The important implementation idea is therefore:

```text
WorkItem records
  -> saved View definitions
  -> board / table / timeline / personal projections
  -> one shared card/detail document
```

The strongest UX is not the visual style of the cards. It is the consistency of the underlying record across views, inline editing of typed properties, and a detail surface that combines metadata, comments, rich content, checklists, and attached artifacts.

For Drawsy, the correct adaptation is:

```text
Canvas objects + backend WorkItems
  -> Canvas view
  -> Kanban view
  -> List/table view
  -> Timeline view
  -> My work view
```

Drawsy should not clone Notion's generic database builder first. It should implement the project-management subset that serves the canvas-to-work loop.

## Observed Information Architecture

### Database/page identity

The project database page exposes:

- page icon,
- editable database title,
- editable description,
- last-edited indicator,
- collaborator avatars/count,
- share control,
- copy-link control,
- favorite control,
- page-level actions menu.

### Saved views

Four saved views were configured:

1. `By Status` — Board grouped by Status.
2. `All Projects` — Full table of project records.
3. `Gantt` — Timeline grouped by Status.
4. `My Projects` — Table filtered to the current assignee.

An `Add view` control is available. The layout picker supports:

- Table
- Board
- Timeline
- Calendar
- List
- Gallery
- Chart
- Feed
- Map
- Dashboard

These are view definitions over the same data source, not duplicated datasets.

## Observed Project Data Model

The database exposes the following properties:

- `Project name` — title
- `Assignee` — multi-person
- `Progress` — progress visualization/number
- `Priority` — select; configured values are High, Medium, Low
- `Attach file` — file/attachment
- `End date` — date
- `End value` — number
- `Start date` — date
- `Start value` — number
- `Status` — status/select
- `Team` — select or multi-select-like field

The current board card visibly shows four properties:

- Project name
- Assignee
- Progress
- Priority

The remaining properties are hidden in the board view but remain available in table, filters, grouping, sorting, and record details.

### Property management behavior

The database-level property manager supports:

- search properties,
- create a new property,
- open each property's configuration,
- change property name and type,
- duplicate property,
- delete property,
- wrap content,
- configure AI Autofill,
- configure sorting/options for enumerated values.

For the observed `Priority` select property, configuration includes:

- type: Select,
- manual option ordering,
- draggable/reorderable values,
- add option,
- edit each option,
- configured color-coded High, Medium, and Low values,
- Generate with AI,
- duplicate/delete property.

## Board View Anatomy

### View toolbar

The board toolbar provides:

- view tabs,
- Filter,
- Sort,
- Automations,
- AI Autofill,
- Search,
- View settings,
- primary `New` action,
- secondary new/template menu.

The controls use icon-first disclosure. Labels are available through tooltips/accessibility names, while configuration opens as a popover or right-side settings panel.

### Columns/groups

The observed groups are:

- Not started
- In progress
- Done

Each group header contains:

- a colored status pill/dot,
- status name,
- record aggregation/count,
- hover-revealed group actions,
- hover-revealed new-page action.

Each group has a `New project` action at the bottom of its card list. Adding from a specific group implies that group's Status value.

### Group actions

The group context menu exposes:

- Edit groups
- Hide aggregation
- Hide group
- Move to Trash

Group configuration exposes:

- Group by property
- grouping mode (`Status by Option` on this board)
- group sort direction
- Hide empty groups toggle
- Color columns toggle
- reorder groups via drag handles
- hide/show individual groups
- pin-related group control
- Hide all

### Group aggregation

Clicking the group header's number exposes aggregation choices:

- Count
- Percent
- Date
- More options:
  - Sum
  - Average
  - Median
  - Min
  - Max
  - Range

On this board, the displayed numbers are record counts.

### Sub-groups

Board settings support a second grouping dimension. Available sub-group properties include:

- Project name
- Assignee
- End date
- End value
- Priority
- Progress
- Start date
- Start value
- Status
- Team

No sub-group is configured in the inspected board.

### Conditional color

The view supports conditional color rules. Notion describes this as a way to distinguish categories, highlight overdue events, and improve clarity. No conditional-color rule is currently configured; the board instead has `Color columns` enabled, causing the status groups/cards to inherit neutral, blue, and green surfaces.

## Card Anatomy

### Resting card

The medium/list-style board card contains:

- record/page icon,
- project title,
- assignee avatar(s) and name(s),
- numeric progress percentage,
- horizontal progress bar,
- priority pill when populated.

Cards inherit a low-contrast tinted background from the status group. Metadata is vertically stacked, aligned consistently, and omitted when empty rather than rendering placeholder rows.

### Hover behavior

Hovering a card reveals two compact controls in its top-right corner:

- open/peek affordance,
- more/context menu.

The card context menu includes:

- Add to Favorites
- Edit icon
- Edit property
- Layout
- Property visibility
- Open in
- Comment
- Copy link
- Duplicate
- Move to
- Move to Trash

Properties on the card are directly interactive. Clicking an assignee opens a multi-person picker without first opening the record. This is efficient but introduces a click-target ambiguity between “open card” and “edit property.” Drawsy should use clearer hit regions.

### Card preview configuration

Board layout settings support:

- Show page icon toggle
- Wrap all content toggle
- Color columns toggle
- Card preview source (configured as None)
- Card size (configured as Medium)
- Card layout:
  - Compact
  - List (configured)
- default card opening mode

### Record opening modes

Cards can open as:

- Side peek
- Center peek
- Full page
- New tab

The view can store its default opening mode. The inspected board uses Side peek.

## Card Detail Surface

The `System Design` record was inspected in side peek.

### Peek shell

The side peek provides:

- resizable divider with keyboard accessibility,
- close control,
- open in full page,
- switch peek mode,
- previous/next record navigation,
- Share,
- Copy link,
- Page info,
- Favorite,
- Actions.

Opening the peek compresses the board but preserves it as context. The selected card remains visually highlighted behind the panel.

### Record header and properties

The record includes:

- icon,
- editable title,
- `View details` expand/collapse control,
- Status,
- Assignee,
- Priority,
- End date,
- inline property editing.

The record body includes:

- comments input,
- `About project` rich-text section,
- `Action items` checklist section,
- `Documents` section,
- Google Drive link/embed,
- `Embed a PDF` action,
- `Embed Figma` action.

This makes a card both a work item and a structured document/artifact hub.

### Record actions

The record-level actions menu includes:

- switch typography: Default, Serif, Mono
- Copy link
- Copy page contents
- Duplicate
- Move to
- Move to Trash
- Small text
- Full width
- Table of contents
- Customize layout
- Lock page
- Use with AI
- Suggest edits
- Translate
- Import
- Export
- Updates & analytics
- Version history
- notification preference
- Connections
- Open in desktop app

For Drawsy, only a subset belongs in the first work-item detail panel. See the adaptation section.

## Creation Flows

### Global creation

The main `New` button creates a record using the default database template. The adjacent dropdown exposes:

- configured default `New project` template,
- Empty record,
- New template.

### Per-column creation

Each status group has:

- a visible bottom `New project` row,
- a hover-revealed header plus button.

The expected behavior is creation prefilled with the group's Status. This reduces form work and keeps creation in context.

### Template principle

Templates are database-specific. A project template can preconfigure properties and body sections such as:

- overview,
- action items,
- documents,
- standard assignee/team defaults,
- standard status/priority defaults.

## Filtering, Sorting, Search, and Personal Views

### Search

Search expands inline in the view toolbar with `Type to search…`. It is scoped to the current database view and filters the visible records without opening a global search surface.

### Filters

Filters can target every property in the schema. The filter picker is searchable.

The advanced filter builder supports:

- property selection,
- property-specific operators (for example, title `Contains`),
- value entry,
- additional rules,
- compound rule construction,
- filter deletion.

The active-filter icon receives a visual state indicator.

### Sorting

Sort supports every property in the schema. A saved view can hold its own ordered sort rules.

### My Projects

`My Projects` is a saved table view with an active assignee filter. It shows only the current user's project(s), retaining columns for:

- Project name
- Assignee
- Priority
- Status
- Start date
- End date

This is not a separate personal database; it is a filtered projection of the same project records.

## All Projects Table

The table view exposes the complete record schema as editable columns:

- Project name
- Assignee
- Status
- Start date
- End date
- Priority
- Team
- Start value
- End value
- Progress
- Attach file

Table behavior observed:

- typed property icons in column headers,
- inline cells,
- color-coded Status/Priority pills,
- progress bars embedded in cells,
- horizontal scrolling for wide schemas,
- add-column control,
- column menu,
- `New project` row at the bottom.

The table is the operational/admin view; the board is the execution view.

## Gantt/Timeline View

The Gantt view is grouped by Status and contains:

- collapsible status sections,
- item count per group,
- left-side project-name list,
- timeline grid,
- month/day header,
- current-day marker,
- `No date (7)` bucket,
- Month scale selector,
- previous/next navigation,
- Today action,
- `Manage in Calendar`,
- optional Notion Calendar connection.

Records without dates stay visible in a no-date bucket rather than disappearing. The dated `System Design` record uses Start date and End date.

## Automations and AI

### Automations

The Automations surface describes actions that can:

- edit properties,
- create pages,
- send updates,
- perform other event-driven work.

This workspace shows an upgrade gate, so rule-builder details were not available.

### AI Autofill

AI Autofill is a database-level/property-level feature that automatically fills properties using workspace and web context. The surface supports creating a new AI Autofill configuration. Individual property settings also expose AI Autofill and `Generate with AI`.

For Drawsy, AI should not silently modify high-impact fields. AI should propose field changes with provenance and optional approval.

## Scrolling and Dragging Observation

### What Notion does

The board uses document-level vertical scrolling. Columns have unequal heights. When the page scrolls:

- status headers become sticky at the top,
- the database toolbar scrolls out of view,
- short columns leave large empty lanes,
- the long column continues through the page,
- the per-column `New project` action remains at the bottom of that column and may be far below the viewport.

The empty horizontal lanes visually preserve the grouping structure, but the drop target is not strongly outlined until interaction.

### Drawsy decision

The current Drawsy direction is better for its workspace shell:

- columns use natural height while resting,
- tall columns are capped and scroll their card list internally,
- headers remain visible,
- `New project` remains pinned,
- all columns expand to full-height drop lanes only during drag,
- hovered drop target receives an explicit outline/background,
- horizontal edge dragging auto-scrolls the board,
- vertical edge dragging auto-scrolls the target card list.

This avoids Notion's “one tall column pushes creation and drop targets out of reach” problem while retaining compact idle layout.

## UX and Visual Details Worth Adapting

### Adopt

- One record, many saved views.
- Status-colored column and card surfaces.
- Count/aggregation beside each group title.
- Per-column creation with status prefilled.
- Hover-only secondary actions.
- Direct property editing from cards.
- Side peek that preserves board context.
- Resizable detail pane.
- Previous/next navigation inside detail pane.
- Configurable visible properties.
- Search/filter/sort scoped to a view.
- Saved personal view (`My work`).
- No-date bucket in timeline.
- Typed property icons and consistent pills/badges.
- Templates for repeatable work-item bodies.
- Comments and artifact links attached to the work item.

### Adapt, not copy

- Use Drawsy's hand-drawn visual language, but keep metadata typography readable and stable.
- Keep card title as the unambiguous open target; property rows are separate edit targets.
- Keep the current internal-scroll/drop-lane behavior rather than Notion's document-height board.
- Use a focused work-item schema rather than exposing a generic property-builder immediately.
- Link cards to canvas elements through `customData.drawsy.workItemId`.
- Surface canvas/frame provenance directly in the detail pane.
- Treat generated artifacts (prototype, PRD, diagram, file, preview URL) as first-class linked objects.
- Make AI changes proposal-based and auditable.

### Do not copy in the first implementation

- generic page typography controls,
- arbitrary database layout marketplace,
- generic map/feed/chart/dashboard views,
- full rich-page block editor,
- desktop-app actions,
- generic import/export matrix,
- unrestricted AI Autofill,
- arbitrary property types before the core work-item loop is validated.

## Recommended Drawsy Data Model

### Work item

```ts
type WorkItem = {
  id: string;
  workspaceId: string;
  boardId: string;
  projectId: string | null;
  title: string;
  description: string;
  statusId: string;
  priority: "low" | "medium" | "high" | null;
  assigneeIds: string[];
  teamIds: string[];
  progress: number;
  startAt: string | null;
  dueAt: string | null;
  canvasRefs: Array<{
    canvasId: string;
    elementId: string;
    frameId: string | null;
  }>;
  checklist: ChecklistItem[];
  artifactIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};
```

### Status

```ts
type WorkStatus = {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  category: "backlog" | "todo" | "in_progress" | "done" | "cancelled";
  order: number;
  hidden: boolean;
};
```

### Saved view

```ts
type WorkView = {
  id: string;
  workspaceId: string;
  name: string;
  type: "kanban" | "list" | "timeline";
  groupBy: "status" | "priority" | "assignee" | "team" | null;
  subGroupBy: "priority" | "assignee" | "team" | null;
  filters: FilterRuleGroup;
  sorts: SortRule[];
  visibleFields: WorkItemField[];
  cardSize: "compact" | "medium";
  cardLayout: "compact" | "list";
  openMode: "side_peek" | "center_peek" | "full";
  colorMode: "group" | "priority" | "none";
  ownerId: string | null;
};
```

### Artifact

```ts
type WorkArtifact = {
  id: string;
  workItemId: string;
  type:
    | "canvas_frame"
    | "document"
    | "file"
    | "figma"
    | "repository"
    | "pull_request"
    | "preview"
    | "external_url";
  title: string;
  url: string | null;
  storageKey: string | null;
  metadata: Record<string, unknown>;
};
```

## Recommended Drawsy Component Architecture

```text
WorkWorkspace
  WorkViewTabs
  WorkViewToolbar
    FilterBuilder
    SortBuilder
    SearchInput
    ViewSettings
    NewWorkItemMenu
  KanbanView
    KanbanColumn
      ColumnHeader
      ColumnAggregation
      ScrollableCardList
      NewWorkItemAction
    WorkItemCard
      CardQuickActions
      InlinePropertyEditors
  WorkItemPeek
    PeekHeader
    WorkItemProperties
    Comments
    Description
    Checklist
    Artifacts
    CanvasBacklinks
```

State boundaries:

- server state: work items, statuses, comments, artifacts, saved views;
- optimistic client state: drag ordering, inline edits, new-card drafts;
- ephemeral UI state: active view, open menus, drag target, peek width;
- persisted personal state: last view, peek width, collapsed groups.

## Required Interaction Flows for Drawsy

### Create in status

```text
Click New project in column
  -> inline title composer
  -> create WorkItem with statusId from column
  -> optimistic card insertion
  -> focus card title or open side peek
```

### Move between statuses

```text
Drag card
  -> all columns become full-height drop lanes
  -> edge auto-scroll activates
  -> target column highlights
  -> drop updates statusId + order
  -> optimistic UI
  -> backend version check
  -> rollback/toast on failure
```

### Open and edit

```text
Click title/card background
  -> open side peek
Click visible property
  -> edit inline without opening peek
```

### Canvas to work item

```text
Select canvas elements/frame
  -> Create task/spec
  -> proposed title/description/status/priority
  -> confirm
  -> create WorkItem
  -> write workItemId into element customData
  -> show linked card in Kanban/List/Timeline
```

### Work item back to canvas

```text
Open work item
  -> Canvas backlinks
  -> Focus element/frame
  -> switch to canvas
  -> zoom/scroll to linked object
```

## Acceptance Criteria

### Kanban

- Cards can be created in a specific status.
- Cards can be reordered and moved between statuses.
- Moving a card updates one shared work item, not a view-specific copy.
- Tall columns scroll internally.
- Headers and create actions remain reachable.
- During drag, every column becomes an obvious full-height target.
- Horizontal and vertical edge auto-scroll work.
- Empty statuses remain valid drop targets.
- Keyboard users can move a card through an action menu.

### Views

- Kanban, list, timeline, and My work use the same records.
- Filters and sorts are saved per view.
- My work derives identity from authenticated user ID, never display text.
- Timeline retains undated items in a no-date bucket.

### Card/detail

- Card visible fields are configurable from a supported subset.
- Title click and property click have distinct behavior.
- Side peek is resizable and preserves board context.
- Detail includes properties, comments, description, checklist, artifacts, and canvas links.
- Previous/next navigation respects current filtered/sorted view order.

### Data integrity

- Every mutation is workspace-scoped and authenticated.
- Drag updates use version/ordering conflict handling.
- Deletes are soft-delete first and undoable.
- AI-generated property changes record provenance.
- External writes and high-impact automation require permission and audit logs.

## Gap Against Current Drawsy Kanban

Current frontend implementation already provides:

- local board schema,
- status columns,
- cards,
- title editing,
- add/delete cards,
- add/delete empty statuses,
- drag between/reorder within columns,
- assignee placeholder,
- progress display,
- priority field in the local type,
- roughness/radius/lock controls,
- local persistence,
- animated add/delete status,
- natural-height idle columns,
- internal scrolling for populated columns,
- drag-time full-height drop lanes,
- drop-target feedback,
- edge auto-scroll.

Major product gaps:

1. Kanban records are not the backend workspace's canonical WorkItems.
2. Kanban is not linked to canvas elements through `customData`.
3. No list/table projection.
4. No timeline projection.
5. No authenticated My work view.
6. No saved filters/sorts/views.
7. No side-peek work-item detail panel.
8. No comments/checklists/artifacts on work items.
9. No multi-assignee/team model.
10. No dates, templates, conditional color, aggregations, or automation model.
11. No optimistic server mutation/conflict handling for task moves.
12. No audit/provenance for AI or integrations.

## Recommended Delivery Order

### Phase 1 — Canonical work items

- Define WorkItem, WorkStatus, ordering, and canvas reference schemas.
- Add authenticated backend CRUD.
- Replace Kanban localStorage as the source of truth while preserving an offline cache.
- Link card status/order mutations to backend versions.

### Phase 2 — Product-grade Kanban

- Inline priority, assignee, progress, and due date editing.
- Status menus and keyboard move actions.
- Work-item side peek.
- Comments, description, checklist, artifacts, and canvas backlinks.
- Optimistic updates, undo, error recovery.

### Phase 3 — Shared views

- List/table view.
- My work saved filter.
- Search, filters, sorts.
- Saved view definitions.
- Timeline with no-date bucket.

### Phase 4 — Canvas and AI differentiation

- Canvas selection to WorkItem.
- WorkItem to canvas focus.
- AI proposal for title/summary/priority/checklist.
- Frame-to-project template.
- Artifact cards for generated prototypes, docs, repos, and previews.

### Phase 5 — Advanced workflow

- Templates.
- Aggregations.
- Conditional color rules.
- Automation events/actions.
- Jira synchronization and MCP tools.

## Final Product Direction

The feature to replicate is not “three colored columns.” It is a typed work-item system with saved projections and contextual detail.

Drawsy's stronger version should be:

```text
visual idea on canvas
  -> linked WorkItem
  -> Kanban/List/Timeline/My work
  -> comments/checklist/artifacts
  -> agent or integration action
  -> reviewed result returned to canvas
```

Notion supplies a strong database-to-board model. Drawsy should retain that structural strength while improving drag usability, making canvas links native, and treating agent-generated outputs as reviewable work artifacts.
