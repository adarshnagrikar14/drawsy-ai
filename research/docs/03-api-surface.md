# API Surface

## Main Component Props

All props are optional.

Key persistence/control props:

- `initialData`
- `excalidrawAPI`
- `onChange`
- `onLibraryChange`
- `onPaste`
- `generateIdForFile`
- `generateLinkForSelection`
- `onLinkOpen`

UI/control props:

- `isCollaborating`
- `viewModeEnabled`
- `zenModeEnabled`
- `gridModeEnabled`
- `theme`
- `langCode`
- `name`
- `UIOptions`
- `renderTopRightUI`
- `renderCustomStats`
- `renderEmbeddable`
- `validateEmbeddable`
- `renderScrollbars`

Environment/behavior props:

- `libraryReturnUrl`
- `detectScroll`
- `handleKeyboardGlobally`
- `autoFocus`

## Custom Element Data

Docs allow storing arbitrary data on elements:

```ts
customData: Record<string, any>
```

This is a major product hook.

Use cases:

- database id mapping
- ownership metadata
- Jira/Miro object references
- AI provenance
- imported source ids
- workflow/status metadata

## `initialData`

Can be an object or promise.

Fields:

- `elements`
- `appState`
- `scrollToContent`
- `libraryItems`
- `files`

This is enough to load a scene from your own backend before the canvas mounts.

## `excalidrawAPI`

Imperative APIs documented:

- `updateScene`
- `updateLibrary`
- `addFiles`
- `resetScene`
- `getSceneElementsIncludingDeleted`
- `getSceneElements`
- `getAppState`
- `history.clear`
- `scrollToContent`
- `refresh`
- `setToast`
- `id`
- `getFiles`
- `setActiveTool`
- `setCursor`
- `resetCursor`
- `toggleSidebar`
- `onChange`
- `onPointerDown`
- `onPointerUp`

Code validation:

- exports are present in `packages/excalidraw/index.tsx`
- sidebar toggle state is modeled by `appState.openSidebar`

## Undo/Redo Capture

`updateScene` supports `captureUpdate`.

Important values:

- `CaptureUpdateAction.IMMEDIATELY` - local user-visible changes, undoable
- `CaptureUpdateAction.EVENTUALLY` - async/multi-step updates
- `CaptureUpdateAction.NEVER` - remote updates or initialization

Lead:

For backend sync/collab, remote patches should usually use `NEVER`, otherwise remote sync can pollute local undo/redo.

## Render Props

Docs expose:

- `renderTopRightUI`
- `renderCustomStats`
- `renderEmbeddable`

`renderEmbeddable` lets host app override built-in iframe rendering.

## UIOptions

Important areas:

- `canvasActions`
- export options
- docked sidebar breakpoint
- tools visibility

Use this to hide native UI when building your own product shell.

## Constants

Docs expose:

- `FONT_FAMILY`
- `THEME`
- `MIME_TYPES`
