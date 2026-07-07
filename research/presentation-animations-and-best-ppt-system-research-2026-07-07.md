# Presentation Animations And Best-PPT System Research

Date: 2026-07-07

## Scope

This note extends the Excalidraw+ presentations research into a deeper product question:

```text
If Drawsy turns canvas frames into slides, what would make those slides feel like a serious presentation product, including PowerPoint-like animation?
```

The core answer: animations should be a presentation metadata layer over the canvas, not a separate PowerPoint document model. The canvas remains the source of truth. Frames define slides. Presentation metadata defines how slides and elements appear, disappear, move, emphasize, transition, export, and play.

Sources used:

- Microsoft PowerPoint support on motion path animations: `https://support.microsoft.com/en-us/powerpoint/add-a-motion-path-animation-effect`
- Microsoft PowerPoint support on Morph transition: `https://support.microsoft.com/en-us/powerpoint/training/use-the-morph-transition-in-powerpoint`
- Microsoft PowerPoint Morph tips for words, characters, fly-out, and zoom-style effects: `https://support.microsoft.com/en-us/powerpoint/morph-transition-tips-and-tricks`
- Apple Keynote support on object animations/builds: `https://support.apple.com/guide/keynote/animate-objects-on-a-slide-tanf96d92cb6/mac`
- Apple Keynote support on build-in/build-out effects: `https://support.apple.com/guide/keynote/animate-objects-onto-and-off-a-slide-tan72234bb6/mac`
- Google Slides support on animations/transitions: `https://support.google.com/docs/answer/1689475`
- Existing local Drawsy/Excalidraw research:
  - `excalidraw-plus-presentations-research-2026-07-07.md`
- Local code search in:
  - `excalidraw-app/`
  - `packages/`

## Executive Read

Yes, presentations are still the same canvas presented in another way. But a serious presentation product needs a second layer:

```text
canvas content
  -> frame/slide extraction
  -> presentation metadata
  -> timeline/build steps
  -> presenter/viewer runtime
  -> export/share/runtime compatibility
```

PowerPoint-quality behavior does not come from one feature called "animation". It comes from a coordinated system:

- slide transitions,
- object entrance/build-in,
- object exit/build-out,
- object emphasis,
- motion paths,
- text sequence animation,
- morph/magic-move between slides,
- timing and click sequencing,
- presenter notes,
- speaker controls,
- themes,
- media handling,
- export compatibility,
- rehearsed delivery,
- accessibility and reduced-motion behavior.

For Drawsy, the best path is not to clone every PowerPoint effect first. The best path is to build a small, composable animation model that can express most useful effects and degrade cleanly when exported.

## Mental Model

There are two different animation levels:

```text
Slide-level transition:
  how Slide A changes into Slide B

Element-level build:
  how objects inside one slide appear, move, emphasize, or disappear
```

PowerPoint, Keynote, and Google Slides all preserve this split. They differ in polish and depth, but the same product grammar appears everywhere.

For Drawsy:

```text
Excalidraw frame = slide
Excalidraw element/group = animatable object
Presentation step = click/timed stage in a slide
Transition = effect between frames
Morph = inferred animation between related elements across frames
```

## What "Best PPT" Means

A best-in-class presentation is not just animated. It is controlled, readable, paced, and deliverable.

The product should support these layers.

### 1. Structure

- Slides generated from frames.
- Clear slide order.
- Slide titles from frame names, with editable presentation titles.
- Sections for grouping slides.
- Slide thumbnails that match actual output.
- Duplicate slide/frame.
- Hide slide from presentation without deleting it.
- Reorder slides independently if needed, but keep relationship to frames explicit.
- Slide aspect ratio control:
  - 16:9 default,
  - 4:3,
  - custom,
  - social/video sizes later.

### 2. Design System

- Theme presets:
  - background,
  - text palette,
  - accent palette,
  - default stroke/fill treatment,
  - title/subtitle/body scale.
- Consistent slide margins and safe areas.
- Alignment guides and snap-to-frame helpers.
- Optional frame templates:
  - title,
  - agenda,
  - two-column,
  - timeline,
  - process,
  - comparison,
  - quote,
  - image spotlight,
  - closing.
- Reusable layouts without forcing the canvas into a rigid slide editor.

### 3. Content Quality

- Text hierarchy:
  - one main idea per slide,
  - short titles,
  - readable body text,
  - bullet reduction.
- Visual hierarchy:
  - contrast,
  - grouping,
  - whitespace,
  - emphasis.
- Diagram quality:
  - connectors,
  - labels,
  - annotations,
  - callouts,
  - progressive reveal.
- Media support:
  - images,
  - GIF/video later,
  - screenshots,
  - embeds later.

### 4. Motion

Motion should serve explanation, not decoration.

The core purposes:

- reveal information in sequence,
- direct attention,
- show change over time,
- compare before/after,
- explain a system flow,
- make a handoff between ideas feel smooth.

Bad motion:

- too many different effects,
- long durations,
- unpredictable direction,
- bounce/spin effects in serious decks,
- motion that competes with the speaker,
- animations that cannot be exported or shared reliably.

## Animation Feature Taxonomy

### Slide Transitions

Transitions happen between slides/frames.

Core set:

- none,
- fade,
- cross-fade,
- push left/right/up/down,
- slide left/right/up/down,
- zoom in,
- zoom out,
- dissolve,
- wipe,
- morph.

For Drawsy MVP, prioritize:

- none,
- fade,
- push,
- zoom,
- morph-lite.

Reason: these match canvas navigation naturally and are relatively easy to render with two frame snapshots or two frame element states.

### Element Entrance

Entrance effects make objects appear.

Core set:

- appear,
- fade in,
- fly in,
- slide in,
- wipe in,
- zoom in,
- draw/sketch in,
- typewriter for text,
- rise/fall,
- pop/scale.

Drawsy-specific opportunity:

- "draw in" should be a first-class effect because Excalidraw content already has hand-drawn semantics. A line, arrow, box, or text group can look like it is being sketched onto the slide.

### Element Exit

Exit effects remove objects.

Core set:

- disappear,
- fade out,
- fly out,
- slide out,
- wipe out,
- zoom out,
- shrink,
- erase/sketch out.

Exit effects matter because they allow a single frame to tell a staged story without duplicating many frames.

### Element Emphasis

Emphasis effects keep an object on-screen but briefly alter attention.

Core set:

- pulse,
- scale,
- color highlight,
- stroke highlight,
- underline/scribble highlight,
- shake,
- glow,
- dim others,
- spotlight,
- rotate slightly,
- bounce only for playful decks.

Drawsy should prioritize explanation-oriented emphasis:

- highlight,
- pulse,
- dim others,
- spotlight,
- scribble underline,
- arrow callout pulse.

### Motion Paths

Motion paths move an element along a line or curve.

PowerPoint exposes predefined and custom paths. The useful cases are:

- moving a label to a new place,
- animating a node through a flow,
- moving a marker along a timeline,
- showing data/process movement,
- moving an object off-canvas.

For Drawsy, custom motion paths can reuse canvas paths:

```text
select object
choose "motion path"
draw path on canvas
path becomes presentation metadata, not a visible element unless toggled
```

This fits Excalidraw because users already understand drawing lines.

### Text Animation

Text has special needs.

Useful granularities:

- whole text box,
- by paragraph,
- by bullet,
- by word,
- by character.

Useful effects:

- appear by bullet,
- fade by paragraph,
- fly in by bullet,
- typewriter,
- word-by-word morph,
- character-level scramble only for playful contexts,
- highlight current bullet while dimming previous bullets.

For serious decks, the most important text animation is not flashy. It is controlled bullet reveal.

Drawsy should support:

```text
Text sequence:
  on click, reveal next paragraph/bullet
  optionally dim previous paragraph/bullet
```

### Morph / Magic Move

Morph is the highest-leverage advanced feature.

PowerPoint Morph works by identifying common objects across two slides and animating movement, size, rotation, color, and other changes. It can also operate at word or character level for text in supported cases.

Key principle:

```text
If two consecutive slides contain the same logical object, animate between its old and new state.
```

For Drawsy:

```text
Frame A element id/group id
  -> Frame B matching element id/group id
  -> interpolate x, y, width, height, angle, opacity, stroke, fill
```

Hard part: Excalidraw frame duplication may create new element IDs depending on copy behavior. Drawsy may need a stable `presentationObjectId` metadata key to preserve identity across frames.

Recommended staged version:

1. Morph exact same element IDs across frames.
2. Add "link for morph" action to manually connect two elements.
3. Add heuristic matching by type/text/image hash/group name.
4. Add text-level morph by word/character later.

## Animation Timeline Model

The product needs a timeline, but it should not look like a video editor first.

A slide can have a sequence of build steps:

```json
{
  "slideId": "frame_123",
  "transition": {
    "type": "fade",
    "durationMs": 350,
    "easing": "easeInOut"
  },
  "steps": [
    {
      "id": "step_1",
      "trigger": "onSlideEnter",
      "animations": [
        {
          "target": "element_title",
          "kind": "entrance",
          "effect": "fadeIn",
          "durationMs": 250,
          "delayMs": 0
        }
      ]
    },
    {
      "id": "step_2",
      "trigger": "onClick",
      "animations": [
        {
          "target": "group_problem",
          "kind": "entrance",
          "effect": "flyIn",
          "direction": "left",
          "durationMs": 350
        }
      ]
    }
  ]
}
```

This gives enough structure for:

- click-to-reveal,
- timed playback,
- grouped animations,
- multiple objects at once,
- per-object duration/delay/easing,
- presenter navigation step-by-step.

### Triggers

Support these triggers:

- on slide enter,
- on click,
- after previous,
- with previous,
- after delay,
- on media end later,
- on remote command later.

### Ordering

Every slide needs:

- visual order in sidebar,
- build step order,
- current step counter in presenter mode,
- ability to skip/rewind steps,
- ability to reset slide animations when revisiting.

### Grouping

Users should animate:

- one element,
- selected elements,
- a group,
- a frame,
- all text bullets in a text box,
- all children matching a simple rule later.

This matters because raw Excalidraw scenes can contain many primitive elements. Animating every primitive separately would be unusable.

## UI Recommendations

### Authoring Sidebar

Extend the Presentation sidebar into tabs:

```text
Slides | Animations | Notes | Export
```

Or, more conservatively:

```text
Presentation panel
  - Slides list
  - selected slide controls
  - selected object animation controls
```

Avoid opening with a complex timeline. Most users need simple controls first.

### Selected Object Animation Panel

When an element/group is selected inside a frame:

- Add animation button.
- Effect type segmented control:
  - In,
  - Emphasis,
  - Out,
  - Motion.
- Effect menu.
- Trigger:
  - on click,
  - with previous,
  - after previous.
- Duration.
- Delay.
- Direction where relevant.
- Preview button.
- Remove animation.

### Slide Transition Panel

When a slide/frame is selected:

- Transition type.
- Duration.
- Direction where relevant.
- Apply to all slides.
- Preview transition.

### Build Order UI

A compact list is enough:

```text
1. Title - Fade in - On slide enter
2. Problem group - Fly in left - On click
3. Arrow - Draw in - With previous
4. Solution group - Fade in - On click
```

Users need reorder handles, duplicate, disable, and delete.

### Timeline UI Later

Only after the simple build order works, add an advanced timeline:

- horizontal time lanes,
- drag delays/durations,
- scrub preview,
- multi-object overlap.

This should be a power-user mode, not the default.

## Presenter Runtime Requirements

Presenter mode must understand both slides and build steps.

Navigation states:

```text
previous step
next step
previous slide
next slide
current slide index
current build step index
```

Keyboard behavior:

- Right/Space: next animation step, then next slide.
- Left: previous animation step, then previous slide.
- Shift+Right: next slide.
- Shift+Left: previous slide.
- Home/End: first/last slide.
- Esc: exit presentation.

Presenter UI:

- slide counter,
- build step counter if relevant,
- next/previous,
- notes,
- timer,
- pointer/laser,
- blackout/whiteout later,
- fullscreen,
- reduced-motion indicator if active.

## Rendering Architecture

Drawsy has two realistic rendering strategies.

### Strategy A: Snapshot-Based

Render each slide/frame into a static bitmap or canvas layer, then animate layers.

Good for:

- slide transitions,
- export previews,
- readonly viewer,
- performance,
- consistent visual output.

Bad for:

- object-level animation,
- text-level animation,
- morph,
- interactive/step editing.

### Strategy B: Element-Based

Render Excalidraw elements with animation transforms applied.

Good for:

- entrance/exit/emphasis,
- draw-in,
- motion paths,
- morph,
- text reveals,
- object-specific timing.

Bad for:

- complexity,
- performance,
- matching Excalidraw's renderer exactly,
- export compatibility.

### Recommended Hybrid

Use element-based rendering in live presenter/viewer mode, but allow snapshot fallback:

```text
static slide:
  render frame normally

animated slide:
  render base layer for non-animated content
  render animated targets as separate overlay layers
  apply CSS/canvas/Web Animations transforms
```

This gives clean performance while keeping per-object animation possible.

## Data Model Recommendation

Do not store animation state inside every Excalidraw element as core element fields. That risks conflict with upstream Excalidraw compatibility.

Use app-level presentation metadata:

```ts
type PresentationDocument = {
  version: 1;
  slides: PresentationSlide[];
  objectLinks?: PresentationObjectLink[];
  theme?: PresentationTheme;
};

type PresentationSlide = {
  id: string;
  frameElementId: string;
  title?: string;
  hidden?: boolean;
  order: number;
  transition?: SlideTransition;
  notes?: string;
  steps: PresentationStep[];
};

type PresentationStep = {
  id: string;
  trigger: "onSlideEnter" | "onClick" | "withPrevious" | "afterPrevious";
  animations: ElementAnimation[];
};

type ElementAnimation = {
  id: string;
  target:
    | { type: "element"; elementId: string }
    | { type: "group"; groupId: string }
    | { type: "textRange"; elementId: string; range: "paragraph" | "word" | "character"; index?: number };
  kind: "entrance" | "exit" | "emphasis" | "motionPath" | "morph";
  effect: string;
  durationMs: number;
  delayMs?: number;
  easing?: string;
  direction?: "left" | "right" | "up" | "down";
  path?: PresentationMotionPath;
};
```

Persist this alongside scene metadata in Drawsy workspace storage. For share links, package it with readonly scene data. For export, send it to the export service.

## Export Implications

### PDF

PDF cannot preserve interactive animations in a normal way. Options:

- export final state only,
- export one page per build step,
- export presenter handout with notes,
- export static slides only.

Recommended default:

```text
PDF export:
  one page per slide, final visual state

PDF advanced option:
  include build steps as separate pages
```

### PPTX

PowerPoint can represent many animations, but exporting exact animation semantics is expensive.

Three tiers:

1. Raster PPTX:
   - one image per slide,
   - no editable elements,
   - no animation,
   - easiest and matches observed Excalidraw+ export behavior.

2. Raster PPTX with build pages:
   - one image per build state,
   - simulates progressive reveals,
   - large files,
   - no editable elements.

3. Native PPTX animation export:
   - map Drawsy animations to PPTX animation XML,
   - preserve some editable shapes/text,
   - high complexity.

Recommended path:

```text
MVP:
  raster PPTX, one slide image per frame

Next:
  optional "include builds" export

Later:
  native export for common shapes/text/effects only
```

### Video/GIF Export

Animation makes video export valuable.

Later feature:

- export MP4 of presentation,
- export GIF for one slide/sequence,
- include timings,
- include pointer optionally.

## Collaboration And Sync

Animation metadata must work with collaboration.

Requirements:

- deterministic IDs,
- conflict-safe edits,
- last-write-wins only for simple fields,
- operation-based updates for reorder/add/delete,
- local-first cache,
- readonly share packaging,
- version migration.

Animation edits are similar to Kanban board edits in shape:

```text
add animation
update animation config
reorder animation step
delete animation
update slide transition
update notes
```

This can use a normalized model and command/event approach like the Kanban backend direction.

## Accessibility And Delivery Quality

Animations must respect user and audience constraints.

Required:

- `prefers-reduced-motion` support.
- Per-presentation "reduce motion" toggle.
- Disable auto-play for accessibility by default.
- Keyboard navigation.
- Visible focus states.
- Sufficient text contrast.
- Speaker notes not exposed in readonly public view unless explicitly enabled.
- Animations must never be required to understand the slide if exported statically.

Reduced motion behavior:

```text
fade/slide/morph/motion path
  -> instant appear or short fade
```

## Animation Presets For Drawsy

Start with a small tasteful set.

### Professional

- Fade in.
- Fade out.
- Push.
- Cross-fade.
- Subtle zoom.
- Highlight.
- Dim others.

### Canvas-Native

- Draw in.
- Erase.
- Scribble underline.
- Arrow trace.
- Path move.

### Explainer

- Step reveal.
- Bullet reveal.
- Spotlight.
- Morph-lite.
- Timeline marker move.

Avoid in early product:

- random,
- checkerboard,
- boomerang,
- excessive spin,
- bounce-heavy transitions,
- novelty effects.

These make the product feel less serious and increase implementation burden.

## Best-PPT Feature Checklist Beyond Animation

A strong presentation product should eventually include:

- Presentation sidebar with thumbnails.
- Slide sections.
- Speaker notes.
- Presenter view.
- Readonly public links.
- Embed links.
- Password/expiry controls later.
- PDF export.
- PPTX export.
- Image export per slide.
- Video export later.
- Theme presets.
- Layout templates.
- Slide numbers/footer controls.
- Brand kit later:
  - fonts,
  - colors,
  - logo,
  - reusable components.
- Comments on slides.
- Version history.
- Live collaboration.
- Remote control from phone.
- Laser pointer.
- Reactions only if useful for live/teaching contexts.
- Timer/rehearsal mode.
- Audience Q&A later.
- Analytics later:
  - views,
  - completion,
  - per-slide dwell.
- AI assist:
  - generate outline,
  - convert canvas to deck,
  - summarize board into slides,
  - improve titles,
  - suggest builds,
  - create speaker notes,
  - make slide more visual,
  - reduce text density.

## Product Taste

Drawsy should not become a generic corporate slide app. The differentiator is:

```text
whiteboard-native decks
  + clear structure
  + tasteful motion
  + fast sharing/export
  + AI-assisted story shaping
```

Design direction:

- keep Excalidraw's hand-drawn warmth,
- add just enough presentation discipline,
- avoid PowerPoint ribbon complexity,
- prefer side panels and compact controls,
- make preview immediate,
- default to subtle motion,
- expose advanced timing only when needed.

The presentation feature should feel like:

```text
I made a visual explanation on a canvas.
Now I can deliver it like a real deck.
```

Not:

```text
I left the canvas and entered a separate slide-design application.
```

## Suggested Build Phases

### Phase 1: Presentation Foundation

- Frames become slides.
- Presentation sidebar.
- Slide thumbnails.
- Start presentation.
- Presenter route.
- Readonly route.
- Speaker notes.
- PDF/PPTX raster export.

### Phase 2: Simple Motion

- Slide transitions:
  - none,
  - fade,
  - push,
  - zoom.
- Object entrance:
  - appear,
  - fade,
  - fly,
  - draw in.
- Object exit:
  - disappear,
  - fade out.
- Build order list.
- On-click sequencing.
- Preview button.

### Phase 3: Better Storytelling

- Bullet reveal.
- Dim previous bullets.
- Highlight/spotlight.
- Motion path from drawn path.
- Apply animation to selected group.
- Presenter step counter.
- Export build steps as PDF/PPTX option.

### Phase 4: Morph

- Morph exact same element IDs across duplicated frames.
- Manual object linking.
- Morph position/scale/rotation/opacity/color.
- Text word-level morph later.
- Image crop/zoom morph later.

### Phase 5: Pro Delivery

- Phone remote.
- Rehearse timings.
- Auto-play.
- Video export.
- Brand/theme kit.
- Analytics.
- AI animation suggestions.

## Implementation Implications For Existing Repo

Current local search did not show an existing dedicated presentation animation model in `excalidraw-app/` or `packages/`. Existing animation mentions are mostly UI/requestAnimationFrame concerns, comments sidebar motion, and general canvas scroll animation.

That means this should be introduced as a new presentation feature layer, not as a change to core Excalidraw rendering semantics.

Likely frontend areas later:

- app-level presentation route/component under `excalidraw-app/`,
- presentation sidebar component,
- presentation metadata store,
- frame extraction helpers,
- thumbnail generation,
- presenter runtime,
- readonly viewer runtime,
- export API client.

Likely backend areas later:

- presentation metadata persistence,
- readonly presentation link records,
- export job endpoint,
- CDN/R2 asset handling for generated thumbnails/previews,
- sharing permissions.

## Hard Problems

### Element Identity Across Slides

Morph depends on knowing that object A on slide 1 is the same logical object as object A on slide 2. Excalidraw element IDs may not be enough when users duplicate frames or copy objects.

Need:

- stable presentation object IDs,
- manual linking UI,
- fallback heuristics.

### Text Granularity

Text animation by bullet/word/character requires text layout data. Excalidraw text layout may need careful measurement to avoid mismatch between static and animated states.

Start with paragraph/bullet reveal before word/character effects.

### Export Fidelity

Live web animation is easier than PPTX-native animation export. Drawsy should not block launch on native PPTX animation export. Raster export is acceptable for early phases, especially because observed Excalidraw+ PPTX export is raster-based.

### Performance

Large Excalidraw scenes can contain many elements. Animation runtime must:

- animate only targets,
- cache static background layers,
- avoid full scene re-render every frame,
- precompute slide bounds,
- pre-load images,
- degrade on low-power devices.

### Collaboration

Two users editing animation order at once can conflict. The metadata needs operation-level changes rather than one giant JSON blob whenever possible.

## Open Questions To Research Later

- How does Excalidraw+ represent slide notes and slide order internally?
- Does Excalidraw+ already have hidden animation metadata or only static presentation?
- Can Excalidraw's renderer expose enough per-element rendering for overlay animation without forking heavily?
- What is the cleanest way to generate frame thumbnails in-app without blocking UI?
- Which PPTX library best supports animation XML if native export becomes necessary?
- How should animation metadata be encrypted/synced with workspace scenes?
- Should presentation metadata live inside the `.excalidraw` scene export or as Drawsy-only workspace metadata?

## Bottom Line

The right architecture is:

```text
Excalidraw scene stays canonical.
Frames define slides.
Presentation metadata defines sequencing, transitions, notes, sharing, and export.
Animations are build steps over element/group targets.
Morph is a later identity-linking problem.
Export starts raster-first and becomes native only where the payoff is real.
```

This gives Drawsy a path to become a strong canvas-native presentation product without copying PowerPoint's full internal complexity on day one.
