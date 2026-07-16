# DRAW.md v1

`DRAW.md` is a deterministic visual project document. The file is canonical; Drawsy renders it into normal canvas elements without AI or network access.

## File contract

- Exact filename: `DRAW.md` at the selected folder root.
- UTF-8 text, maximum 512 KiB.
- At least one fenced `mermaid` block is required.
- Optional YAML frontmatter is accepted and reserved for later versions.

````md
---
draw: 1
---

# System map

Short project context.

```mermaid
flowchart LR
  Web --> API --> DB
```

## Ownership

- API owns authentication
- DB stores workspaces
````

## Rendering contract

- H1 and H2 headings begin named canvas frames.
- H3–H6 headings remain inside the current frame.
- Paragraphs, ordered/unordered lists, blockquotes, links, and fenced code are rendered as supporting text.
- Fenced `mermaid` blocks become editable Excalidraw diagrams.
- Horizontal rules are structural separators and are not drawn.
- Unsupported blocks are skipped and reported without blocking valid content.

## Canvas behavior

- The first render is placed beyond the rightmost existing canvas content with visible spacing; Drawsy does not pan or zoom the user's viewport.
- Reopening the same unchanged file never duplicates it.
- A changed file refreshes only its own generated elements and keeps their existing canvas position.
- Unrelated canvas elements are never moved, replaced, or deleted.
- Invalid Mermaid blocks show an inline failure note while valid sections still render.
