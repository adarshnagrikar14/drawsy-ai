# Excalidraw+ Presentations Research

Date: 2026-07-07

## Scope

This note captures the next research leg after Kanban: how Excalidraw+ uses presentations, what parts already exist in `excal-ai`, and what Drawsy should build first.

Sources inspected:

- Excalidraw+ presentations use-case page: `https://plus.excalidraw.com/use-cases/presentations`
- Excalidraw+ readonly presentation example: `https://link.excalidraw.com/p/readonly/LF1Z5T1eAeBQNvlcAFz2?darkMode=true`
- Logged-in Excalidraw+ app with Plus subscription in Chrome:
  - editor scene route: `https://app.excalidraw.com/s/{workspaceId}/{sceneId}`
  - live presenter route: `https://app.excalidraw.com/p/{workspaceId}/{sceneId}`
  - generated readonly route: `https://link.excalidraw.com/p/readonly/{presentationLinkId}`
- Network/API traces from Chrome DevTools Protocol.
- Downloaded PDF/PPTX export artifacts from the logged-in Plus app.
- Local code search in `excalidraw-app/`, `packages/excalidraw/`, and `packages/element/`

Earlier browser note: the readonly presentation opened successfully in the Browser plugin and showed the presentation surface. The heavier Plus use-case page repeatedly timed out in the browser automation bridge, so its static HTML content was inspected separately.

Update from logged-in Plus exploration: Chrome was connected to a paid Plus account. The existing scene was inspected through the real `app.excalidraw.com` UI. Presentation sharing was enabled once to observe the generated readonly link/API behavior, and PDF/PPTX exports were downloaded to inspect output fidelity.

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

## Logged-In Plus Exploration Findings

Date: 2026-07-07

Environment:

- Chrome profile signed into Excalidraw+ with a Plus subscription.
- Observed scene: `https://app.excalidraw.com/s/{workspaceId}/{sceneId}`.
- Presentation route after starting: `https://app.excalidraw.com/p/{workspaceId}/{sceneId}`.
- Generated readonly route: `https://link.excalidraw.com/p/readonly/{presentationLinkId}`.

### Product Shape

The Plus implementation confirms the earlier thesis:

```text
normal Excalidraw scene
  -> frames become slides
  -> presentation sidebar manages slide selection/notes/share/export
  -> live presenter route controls delivery
  -> readonly link route controls public viewing
```

It is not a PowerPoint-like document model. The canvas remains the source of truth. Presentations are an app/product layer around frame elements, thumbnails, notes, share options, export, and presenter controls.

### Authoring UI

The right sidebar has a dedicated `Presentation` tab. In the observed scene it showed:

- `Slides (4)` or `Slides (2 selected out of 4)` depending on selection state.
- One card per slide/frame.
- Large visual thumbnails generated from frame contents.
- Slide labels from frame names:
  - `titles_12_blocky`
  - `titles_10_tetris`
  - fallback labels such as `Slide 3`, `Slide 4`
- A checkbox/select affordance on each slide card.
- Per-slide overflow menu on cards.
- Per-slide notes button with tooltip/title `Add notes`.
- A sticky bottom `Start presentation` button.
- Header action icons:
  - slide/document-style view
  - grid/sort-style view
  - plus/add
  - overflow menu

Important UX detail: slide cards are not abstract list rows. They are miniature deck previews. This makes the feature feel spatial and canvas-native.

### Authoring Sidebar Behavior

Observed behavior:

- Clicking a slide card selects/focuses the corresponding frame on the canvas.
- Multiple selected slides are reflected in the sidebar count.
- The canvas itself remains editable while the presentation panel is open.
- Presentation authoring does not replace the Excalidraw toolbar; it sits beside it.
- The feature uses the existing dark Excalidraw shell and does not introduce a separate branded editor.

The mental model is:

```text
canvas is for making
sidebar is for sequencing and presentation metadata
presenter route is for delivery
share modal is for publication
export service is for files
```

### Slide Creation Implication

The `+` button is present in the Presentation panel header. I did not create a new slide during this pass to avoid mutating the user's scene. Based on the surrounding UI, the likely behavior is either:

- create a new frame/slide, or
- add current/selected frames to the presentation list.

For Drawsy, we should verify this explicitly in a disposable scene before copying the exact behavior.

### Speaker Notes

Speaker notes exist in both authoring and presenter contexts.

Authoring:

- Each slide card has an `Add notes` button.

Presenter:

- A side notes drawer opens from the top-right note icon.
- Drawer title: `Speaker notes`.
- Empty state: `No notes for this slide yet`.
- Font controls:
  - `A-`
  - `A+`

Notes are presenter-only metadata. They do not appear as visible slide content. In the exported PPTX, notes slide XML files are present, even when the inspected scene had no meaningful notes:

```text
ppt/notesSlides/notesSlide1.xml
ppt/notesSlides/notesSlide2.xml
ppt/notesSlides/notesSlide3.xml
ppt/notesSlides/notesSlide4.xml
```

Implication: notes are part of the presentation model, not just transient UI.

## Live Presenter Mode

Starting presentation changes the route and document title:

```text
/s/{workspaceId}/{sceneId}
  -> /p/{workspaceId}/{sceneId}

title:
  "Untitled scene — Excalidraw Plus"
  -> "🔴 Live presentation — Excalidraw Plus"
```

Visible live presenter UI:

- Full-screen-ish canvas view.
- Active slide/frame fitted to viewport.
- Bottom floating control bar.
- `Slide 1/4` counter.
- Previous/next controls.
- Pointer/laser-style control.
- Phone/remote-style control icon.
- Theme control.
- Fullscreen control.
- Reaction/emoji-style control.
- Settings control.
- Red `End presentation` button.
- Top-right speaker notes button.

The toolbar can hide/minimize during presentation, especially after pointer/laser interactions, so the presentation content stays dominant.

### Presenter Design

The presenter surface is intentionally sparse:

- dark background for live mode,
- floating rounded toolbar,
- low-contrast chrome,
- red destructive end button,
- purple active accents,
- no editing toolbars,
- no slide sidebar unless notes are opened.

The presentation still visually looks like Excalidraw. Hand-drawn frames, rough outlines, Excalidraw fonts, and canvas colors are preserved. The product is not trying to "polish away" the whiteboard aesthetic.

### Presenter Navigation

Observed:

- Slide state is exposed as `Slide n/m`.
- Prev/next controls are primary.
- The live URL itself did not include a slide index in the observed first-slide state.

Unknown from this pass:

- Whether slide index is encoded in internal state, URL hash, broadcast channel, or server session.
- Whether remote phone control uses a websocket, SSE, polling, or backend command endpoint.

This should be explored in a disposable scene/session by opening the phone remote flow and capturing network events.

## Readonly Presentation Viewer

Generated readonly link:

```text
https://link.excalidraw.com/p/readonly/{presentationLinkId}
```

Observed title:

```text
Untitled scene presentation - Excalidraw+
```

Visible readonly UI:

- slide title text shown in the page when enabled (`titles_12_blocky` observed),
- full slide content fitted to viewport,
- bottom floating toolbar,
- previous/next,
- `Slide 1/4`,
- theme toggle,
- download button when allowed,
- fullscreen button.

Readonly viewer is lighter than live presenter:

- no `End presentation`,
- no speaker notes,
- no editing tools,
- no workspace/sidebar shell,
- no visible account/workspace chrome.

The readonly viewer also respects share options:

- show slide title,
- animate slides,
- allow download,
- auto-play slides,
- starting slide.

When `Show slide title` was enabled, the frame/slide name appeared above the slide in the readonly viewer. This means slide titles are presentation/viewer metadata, not necessarily drawn text on the canvas.

## Share Presentation Flow

Entry point:

```text
Presentation sidebar overflow
  -> Share slides
```

The same share modal contains tabs:

- `Share scene`
- `Embed link`
- `Share presentation`

The `Share presentation` tab contains:

- `Share presentation slides` toggle
- preview area
- refresh/regenerate preview button
- options:
  - `Show slide title`
  - `Animate slides`
  - `Allow download`
  - `Auto-play slides`
- `Starting slide`
  - helper: `Choose which slide to start the presentation from`
  - default: `From beginning`
- link type tabs:
  - `Read-only link`
  - `Embed iframe`
- link field

Before enabling:

```text
Share presentation slides: Disabled
No preview available
Link shown as placeholder-ish:
https://link.excalidraw.com/p/readonly/abcdef
```

After enabling:

```text
Share presentation slides: Enabled
Preview image appears
Generated readonly link:
https://link.excalidraw.com/p/readonly/{presentationLinkId}
```

### Share API Signals

Observed network:

```text
GET/OPTIONS https://backend.excalidraw.com/api/scene/{sceneId}/slides
```

Before enabling, the slides endpoint returned `404` for this scene's presentation link state. After enabling, it returned `200`.

Preview asset:

```text
https://excalidraw.nyc3.cdn.digitaloceanspaces.com/
  scene/{sceneId}/scene_links/{presentationLinkId}/{assetId}.png
```

This suggests a backend model roughly like:

```text
scene
  -> slide/share presentation settings
  -> generated public link id
  -> generated preview PNG in object storage/CDN
  -> readonly link app loads by public presentation link id
```

Likely entities:

```ts
type SceneSlidesShare = {
  sceneId: string;
  linkId: string;
  enabled: boolean;
  showSlideTitle: boolean;
  animateSlides: boolean;
  allowDownload: boolean;
  autoPlaySlides: boolean;
  startingSlide: "beginning" | string;
  previewImageKey: string;
  updatedAt: number;
};
```

The exact response body was not captured in this pass, but the route shape and UI state are clear.

## Export Flow

The Presentation sidebar overflow has:

- `Share slides`
- `Slides as PDF`
- `Slides as PPTX`

### PDF Export

Clicking `Slides as PDF` produced a success toast:

```text
Downloaded "Untitled scene" presentation as PDF
```

Observed network:

```text
https://export.excalidraw.com/api/v1/export/s/{sceneId}/format/pdf/presentation
```

Exported file:

```text
Untitled-scene.pdf
```

PDF inspection:

```text
Creator: PDFKit
Producer: PDFKit
Pages: 4
Page size: 600 x 337 pts
PDF version: 1.3
```

### PPTX Export

Clicking `Slides as PPTX` produced:

```text
Downloaded "Untitled scene" presentation as PPTX
```

Observed network:

```text
https://export.excalidraw.com/api/v1/export/s/{sceneId}/format/pptx/presentation
```

Exported file:

```text
Untitled-scene.pptx
```

PPTX inspection:

```text
slides: 4
media PNGs: 4
notes slides: 4
```

Each slide XML contained one `<p:pic>` and no editable PowerPoint text/shapes:

```text
ppt/slides/slide1.xml -> pics 1, shapes 0, text nodes 0
ppt/slides/slide2.xml -> pics 1, shapes 0, text nodes 0
ppt/slides/slide3.xml -> pics 1, shapes 0, text nodes 0
ppt/slides/slide4.xml -> pics 1, shapes 0, text nodes 0
```

Conclusion: Excalidraw+ PPTX export rasterizes each slide/frame into a PNG and places that image into a PowerPoint slide. It does not export editable PowerPoint-native shapes/text.

This is strategically important for Drawsy. We do not need a full Excalidraw-to-PowerPoint vector translator to match the current Plus baseline.

## Backend/API Architecture Inferred From Observation

Observed backend domains:

```text
app.excalidraw.com
backend.excalidraw.com
link.excalidraw.com
export.excalidraw.com
excalidraw.nyc3.cdn.digitaloceanspaces.com
umami.excalidraw.com
```

Observed routes:

```text
/api/scene/{sceneId}/metadata
/api/workspace/{workspaceId}/collections
/api/scene/{workspaceId}/{sceneId}/contents
/api/scene/{sceneId}/slides
/api/v1/export/s/{sceneId}/format/pdf/presentation
/api/v1/export/s/{sceneId}/format/pptx/presentation
```

Route meanings inferred:

- `metadata`: scene title, workspace placement, permissions, sharing state.
- `collections`: workspace dashboard/organization metadata.
- `contents`: scene document payload.
- `slides`: presentation share settings and generated readonly/preview state.
- `export`: stateless or authenticated export generation for scene presentations.

Presentation routes:

```text
app.excalidraw.com/s/{workspaceId}/{sceneId}
  editor

app.excalidraw.com/p/{workspaceId}/{sceneId}
  authenticated live presenter

link.excalidraw.com/p/readonly/{presentationLinkId}
  public/readonly presentation viewer
```

This is a clean product split. Drawsy should copy the separation:

```text
/canvas/:canvasId
  editable workspace scene

/present/:canvasId
  authenticated presenter mode

/p/readonly/:token
  public readonly deck
```

## Design Language And Taste

The presentation feature inherits Excalidraw's product taste:

- utilitarian controls,
- quiet dark surfaces,
- purple active/accent color,
- compact icon-first toolbar,
- no marketing copy inside the work surface,
- thumbnails over text-heavy lists,
- content-first presentation mode,
- destructive actions colored red,
- soft but not playful rounded corners,
- no heavy card nesting,
- no decorative backgrounds.

The feature feels like a professional tool, not a slide-template marketplace. The canvas content stays visually dominant.

Specific design decisions worth copying:

- Use thumbnails as the primary slide list affordance.
- Keep `Start presentation` sticky and full width at the bottom of the panel.
- Keep share/export in overflow, not as giant primary actions.
- Treat speaker notes as secondary, slide-scoped metadata.
- Let readonly viewer have minimal controls and no app shell.
- Let live presenter use a darker, more focused surface than readonly viewer.
- Make export/share success visible through toasts.

Specific decisions to avoid for Drawsy:

- Do not build a full slide editor first.
- Do not expose too many layout/template controls before frame sequencing works.
- Do not make PPTX export block MVP; rasterized slides are enough initially.
- Do not overload collaboration-room controls for presentation remote control.

## Drawsy Implementation Implications From Plus

Plus baseline we should match first:

```text
frames -> slide thumbnails -> present -> readonly share -> PDF/PPTX raster export
```

Drawsy MVP should be:

1. Detect frames as slides.
2. Render a right sidebar Presentation tab.
3. Show frame thumbnails and names.
4. Allow slide selection/order.
5. Start presenter mode on `/present/:canvasId`.
6. Provide `Slide n/m`, prev/next, theme, fullscreen, notes, exit.
7. Add share/export later through backend routes.

Backend can be simpler than Plus at first:

```text
canvas scene in R2/Firestore
  -> presentation metadata doc
  -> optional public readonly token
  -> generated preview PNGs
  -> export job endpoint
```

Suggested Drawsy endpoints:

```text
GET  /v1/canvases/:id/presentation
PUT  /v1/canvases/:id/presentation
POST /v1/canvases/:id/presentation/share
PATCH /v1/canvases/:id/presentation/share
GET  /v1/presentations/readonly/:token
POST /v1/canvases/:id/presentation/export/pdf
POST /v1/canvases/:id/presentation/export/pptx
```

Export architecture can start raster-first:

```text
for each slide frame
  -> render frame to PNG
  -> PDF: one image per page
  -> PPTX: one image per slide
  -> preserve notes if available
```

This matches observed Excalidraw+ output while avoiding a hard editable-PPTX conversion problem.

## Unknowns To Explore Later

These need a disposable scene or deeper response-body capture:

- Exact payload of `/api/scene/{sceneId}/slides`.
- Exact persistence location/schema for slide notes.
- Whether slide order is explicit metadata or derived from frame order until customized.
- Whether `+` creates a frame or only adds existing frames to the slide list.
- Whether per-slide overflow includes duplicate, hide, remove from presentation, or rename.
- Whether phone remote uses websocket, SSE, polling, or a backend command endpoint.
- Whether animations are CSS-only transitions or per-slide rendered states.
- Whether readonly download respects the same export endpoint or a link-token export endpoint.

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
