# Codebase Formats

## `.excalidraw` File Format

Docs say local scene files are JSON.

Top-level fields:

- `type`
- `version`
- `source`
- `elements`
- `appState`
- `files`

`files` stores image data keyed by file id.

## Clipboard Format

Docs describe Excalidraw clipboard JSON separately from file JSON.

Clipboard format includes:

- `type`
- `elements`
- `files`

## Frames

Docs define a strict ordering rule:

Frame children must come first, followed by the frame element.

Example order:

```ts
[
  frame1_child1,
  frame1_child2,
  frame1,
  frame2_child1,
  frame2_child2,
  frame2,
]
```

Why it matters:

If backend/AI/import code creates frames, wrong ordering can break expected frame behavior.

## Programmatic Elements

Docs expose `convertToExcalidrawElements`.

Supported generation areas:

- rectangles
- ellipses
- diamonds
- text
- lines
- arrows
- text containers
- labelled arrows
- arrow bindings
- frames

Lead:

For AI generation, emit skeleton elements and let `convertToExcalidrawElements` normalize them. Do not hand-roll full element JSON unless needed.
