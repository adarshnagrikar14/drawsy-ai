# Surprise Leads

## 1. The Best Self-Hosted Product Path Is Package-First, Not Fork-First

The docs are strongest around embedding `@excalidraw/excalidraw`.

For a Plus-like product, a clean architecture is:

- your app owns auth/workspaces/docs
- embed Excalidraw as editor
- load scene via `initialData`
- save via `onChange`
- command editor via `excalidrawAPI`
- add product UI via `Sidebar`, `MainMenu`, `Footer`

This avoids fighting upstream app internals.

## 2. `customData` Is A Hidden Product Primitive

Every element can carry `customData`.

This can link canvas elements to:

- database rows
- Jira issues
- Miro imports
- AI prompts
- generated component ids
- comments/mentions
- ownership metadata

This is likely more valuable than modifying element schema.

## 3. Mermaid Is The Cheap AI Diagram Backend

Instead of making an AI model directly emit complex Excalidraw JSON:

1. prompt AI to emit Mermaid flowchart
2. parse via `@excalidraw/mermaid-to-excalidraw`
3. convert via `convertToExcalidrawElements`
4. insert with `updateScene`

Result: editable diagrams with much lower backend complexity.

## 4. Undo/Redo Can Break If Remote Updates Are Captured

`updateScene` has `captureUpdate`.

Remote sync/import/init updates should generally use `CaptureUpdateAction.NEVER`.

Otherwise workspace sync can poison local undo history.

## 5. Exported Images May Contain Private Scene Data

`exportEmbedScene` can embed scene data inside PNG/SVG.

For a private workspace product, this needs a clear policy:

- disable by default for sensitive diagrams, or
- warn users, or
- strip metadata on backend export

## 6. The Docs Are Slightly Behind Some Package Details

Example:

- docs mention `useHandleLibrary(getInitialLibraryItems)`
- changelog mentions newer adapter/migration adapter pattern

Action:

Before implementing library persistence, inspect current source/types, not docs only.

## 7. Sidebar Is The Missing Profile/MCP Surface

The official sidebar API already supports custom tabs.

That means your “Profile / MCP / Workspace” UI can be implemented as host-app tabs without changing core canvas behavior.

## 8. Official Self-Hosting Statement Is Narrow But Important

Docs say self-hosting does not support sharing/collaboration.

That does not mean impossible.

It means the plain client/Docker image is not enough. You need:

- room server for live collaboration
- persistence backend
- file storage
- auth/session system
- env wiring

## 9. Frame Ordering Matters For AI Generation

If AI generates frames, children must come before frames.

This is easy to miss and can cause weird frame behavior.

## 10. The Public Docs Confirm The Boundary

The docs are developer/package docs. They do not expose Plus architecture.

That supports the earlier finding:

- open editor: present
- package APIs: present
- AI frontend hooks: present in repo, not docs
- Plus product/backend/workspace: not present
