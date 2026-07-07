# Excalidraw+ Presentations Research

Date: 2026-07-07

## Scope

This note captures the next research leg after Kanban: how Excalidraw+ uses presentations, what parts already exist in `excal-ai`, and what Drawsy should build first.

Sources inspected:

- Excalidraw+ presentations use-case page: `https://plus.excalidraw.com/use-cases/presentations`
- Excalidraw+ readonly presentation example: `https://link.excalidraw.com/p/readonly/LF1Z5T1eAeBQNvlcAFz2?darkMode=true`
- Local code search in `excalidraw-app/`, `packages/excalidraw/`, and `packages/element/`

Browser note: the readonly presentation opened successfully in the Browser plugin and showed the presentation surface. The heavier Plus use-case page repeatedly timed out in the browser automation bridge, so its static HTML content was inspected separately. No browser tests or app mutations were run.

## Executive Read

Excalidraw+ presentations are not a separate slide-editor product. They are a presentation mode over normal Excalidraw scenes where frames become slides.

The core product move is:

```text
Canvas content
  -> frame tool
  -> ordered slides
  -> present/share/export
```

For Drawsy, this is a strong fit after Kanban because it reuses the same canvas-first principle:

```text
Canvas artifacts + frames
  -> presentation view
  -> shareable readonly deck
  -> PDF/PPTX export
  -> later AI/agent-assisted deck generation
```

The simplest useful MVP should not start as PowerPoint clone. It should turn existing Excalidraw frames into a clean presenter/viewer mode, then add export/share.

## What Excalidraw+ Says The Feature Is

The Plus page positions presentations as an Excalidraw+ feature that turns ideas, illustrations, and canvas creations into slides using the Frame tool.

Observed product promises:

- Create diagrams, sketches, and illustrations in the normal whiteboard.
- Use frames as slides.
- Present online with screen sharing, voice hangouts, and laser pointer.
- Present live by controlling slides from a phone via QR code.
- Share slides through a link.
- Export presentations to PDF or PPTX.
- Embed a presentation in a web page.

The page's own implementation path is simple: draw first, frame second, present/export third. It does not describe a full slide layout system with master templates, speaker notes, transitions, animations, or complex object timing.

## Readonly Presentation Example

The readonly example resolved to:

```text
Presenting Information Visually presentation - Excalidraw+
```

The browser-visible deck showed:

- A full-screen Excalidraw canvas.
- Dark-mode presentation view.
- A slide counter: `Slide 1/12`.
- Previous/next slide controls around the counter.
- Top-left controls for theme/view actions, download, and fullscreen.
- Zoom/help/zen-mode controls inherited from the Excalidraw shell.
- Content is still visibly hand-drawn Excalidraw content, not converted into a separate polished slide renderer.

This matters: the presentation surface appears to be a viewer/presenter layer over the scene, not a separate document model.

## Local Codebase Fit

The local `excal-ai` repo already has several primitives needed for a presentations MVP.

### Frames

Relevant files:

- `packages/excalidraw/actions/actionFrame.ts`
- `packages/element/src/newElement.ts`
- `packages/element/src/frame.ts`
- `packages/excalidraw/scene/export.ts`

Existing capabilities:

- `actionSetFrameAsActiveTool` activates the frame tool.
- `actionWrapSelectionInFrame` wraps selected elements into a new frame.
- Frame elements are first-class elements with `type: "frame"`.
- Child elements link to frames through `frameId`.
- Frame rendering already supports enabled/outline/name/clip settings.
- Export code has frame-aware rendering and clipping behavior.

Implication: Drawsy should not invent a new slide element type for the first version. A slide can be a frame plus presentation metadata.

### Laser Pointer

Relevant files:

- `packages/excalidraw/components/LaserPointerButton.tsx`
- `packages/excalidraw/laserTrails.ts`
- `packages/excalidraw/tests/laser.test.tsx`

Existing capability:

- Laser pointer already exists as a tool surface.

Implication: online/live presentation can reuse the existing laser pointer affordance once presenter mode is available.

### Sharing And QR

Relevant files:

- `excalidraw-app/share/ShareDialog.tsx`
- `excalidraw-app/share/QRCode.tsx`
- `excalidraw-app/share/qrcode.chunk.ts`
- `packages/excalidraw/components/ShareableLinkDialog.tsx`

Existing capability:

- Collaboration/share dialog already renders QR codes for active room links.
- Shareable links and collaboration links already exist in the app.

Implication: phone remote control and deck sharing should reuse QR/link patterns, but they need new semantics. A remote-control QR is not the same as a collaboration-room QR.

### Export

Relevant files:

- `packages/excalidraw/actions/actionExport.tsx`
- `packages/excalidraw/scene/export.ts`
- `packages/excalidraw/components/ImageExportDialog.tsx`
- `packages/excalidraw/components/JSONExportDialog.tsx`

Existing capability:

- Export already supports image/JSON flows.
- Frame-aware scene export exists.

Missing:

- No obvious first-class PPTX export implementation was found.
- No first-class multi-frame PDF deck export was identified in this pass.

Implication: export can come after a frame deck model is stable. PDF is likely simpler than PPTX.

## Proposed Drawsy Product Model

Keep the first model narrow:

```ts
type Presentation = {
  id: string;
  workspaceId: string;
  canvasId: string;
  title: string;
  slideFrameIds: string[];
  theme: "canvas" | "light" | "dark";
  createdAt: number;
  updatedAt: number;
};
```

This can initially live in the canvas scene/app metadata or workspace backend metadata. Long-term, it should be backend-canonical because share links, remote control, and export jobs need stable deck state.

Frame ordering should not rely only on raw scene array order unless the existing frame ordering behavior is proven stable for presentation. The safer MVP is:

- default order from visual/top-left or scene order,
- store explicit `slideFrameIds`,
- let users reorder slides in a compact slide list.

## MVP Recommendation

### Phase 1: Local Frame Presenter

Goal: turn a canvas with frames into a deck locally.

Required behavior:

- Detect frames in the active canvas.
- Show `Slide n/m`.
- Navigate previous/next.
- Fit active frame to viewport.
- Hide editing chrome enough to feel like a presentation.
- Preserve normal Excalidraw canvas rendering.
- Use keyboard navigation: arrow keys and space.
- Exit presenter mode back to editor.

Do not build yet:

- PPTX export.
- Phone remote.
- Public readonly routes.
- Voice hangouts.
- Collaboration-specific presenter handoff.

### Phase 2: Presentation Outline

Goal: make the deck manageable, not just navigable.

Required behavior:

- Slide list/sidebar from frames.
- Rename slides through frame names.
- Reorder slides without changing canvas geometry.
- Add "create frame from selection" as the primary slide creation action.
- Warn when no frames exist and offer to wrap selected content in a frame.

### Phase 3: Shareable Readonly Deck

Goal: match the readonly link behavior.

Required behavior:

- Save presentation metadata through workspace backend.
- Generate readonly presentation URL.
- Render deck without editor mutation tools.
- Support dark/light query or stored theme.
- Preserve access control according to workspace/share policy.

This should probably use `drawsy-ai-backend` rather than the existing share-link JSON API, because presentation access will likely need workspace ownership, comments/work-items context, and future agent hooks.

### Phase 4: Export

Goal: portable deck output.

Recommended order:

1. PDF export from frames.
2. PNG image bundle.
3. PPTX export.

PPTX is valuable but should not be the first proof. PDF export validates slide ordering, frame clipping, sizing, and background behavior with a smaller surface area.

### Phase 5: Live/Remote Control

Goal: presenter controls and audience usability.

Required behavior:

- QR code for phone remote control.
- Presenter session token with short expiry.
- Remote next/previous only for MVP.
- Laser pointer in presenter mode.
- Optional audience readonly link.

Do not reuse collaboration-room write access for phone remote. The remote should control presentation navigation, not edit the scene.

## Backend Implications

Current backend already has useful patterns:

- authenticated workspace routes,
- canvas/project versioning,
- R2 scene storage,
- comments cleanup,
- Kanban command/realtime design.

Presentation backend can start much simpler than Kanban:

```text
GET  /v1/presentations
POST /v1/presentations
GET  /v1/presentations/:id
PUT  /v1/presentations/:id
POST /v1/presentations/:id/share-links
GET  /v1/presentations/readonly/:token
```

Remote control can be separate:

```text
POST /v1/presentations/:id/sessions
POST /v1/presentation-sessions/:sessionId/commands
GET  /v1/presentation-sessions/:sessionId/events
```

For the first local MVP, no backend is required.

## UI Placement

Best entry points:

- Workspace/canvas header: "Present" action when current canvas has frames.
- Main menu/export area: "Export presentation".
- Frame context menu: "Start presentation from this frame".
- Future workspace sidebar: presentations as saved artifacts.

The feature should remain inside the actual product surface. Avoid a marketing-style presentation landing page inside the app.

## Data Integrity Rules

- A slide references a frame by id.
- If a frame is deleted, the presentation should mark the slide missing or remove it with undo support.
- If a frame is duplicated, it should not automatically become a slide unless the user asks.
- If frame dimensions change, the slide should render from the new dimensions.
- Slide ordering should be explicit once the user reorders it.
- Presenter/viewer mode should not capture remote scene updates into local undo history.

## Acceptance Criteria For First Implementation

Local presenter:

- A canvas with three frames opens presenter mode.
- The active frame fits the viewport.
- Previous/next moves across all frames.
- `Slide n/m` updates correctly.
- Escape exits presentation mode.
- If no frames exist, the user sees a useful empty state.
- Existing editor state is restored after exit.

Slide outline:

- User can see all frame-backed slides.
- User can reorder slide order.
- User can rename frame/slide.
- Reorder does not physically move canvas elements.

Readonly share:

- Shared deck opens without editor tools.
- Slide navigation works without sign-in when link policy allows.
- Deck respects dark/light mode.
- Original workspace canvas is not mutated by readonly viewing.

Export:

- Each frame exports as one page/image.
- Frame clipping and background are correct.
- Frame names are handled predictably.
- Missing/deleted frames do not crash export.

## Risks

- Frame order ambiguity: scene order, visual order, and user mental order may differ.
- Frame clipping/export behavior may differ between canvas renderer and static export.
- Existing share-link storage is encrypted scene sharing, not a workspace-aware deck permission model.
- Phone remote control can accidentally become an editing/collaboration channel if scoped poorly.
- PPTX export can become a large compatibility project; start with PDF.
- Presentation mode must not fork the Excalidraw editor too deeply, or upstream merges become painful.

## Recommended First Build

Build `FramePresenter` in the frontend first:

```text
read current scene frames
  -> derive slide list
  -> enter fullscreen-ish presenter shell
  -> zoom/scroll active frame into view
  -> previous/next/exit
```

Keep the model local until the interaction feels correct. Once the deck flow is validated, persist explicit slide order and share/export metadata through the workspace backend.

## Product Direction

Drawsy presentations should be "canvas-native decks", not a general slide editor.

The differentiator is not matching PowerPoint. It is:

```text
diagramming + whiteboard thinking + work items + AI/agent outputs
  -> framed narrative
  -> instant deck/share/export
```

That fits the current roadmap: Kanban turns canvas thinking into work; presentations turn canvas thinking into communication.
