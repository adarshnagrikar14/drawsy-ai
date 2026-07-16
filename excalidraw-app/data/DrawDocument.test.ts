import { applyDarkModeFilter } from "@excalidraw/common";
import { describe, expect, it } from "vitest";

import {
  createDrawDocumentElements,
  getDrawDocumentMetadata,
  parseDrawDocument,
} from "./DrawDocument";

describe("DRAW.md parsing", () => {
  it("keeps Mermaid and supporting Markdown in visual sections", () => {
    const document = parseDrawDocument(`---
draw: 1
---
# Project map

Short project context.

\`\`\`mermaid
flowchart LR
  Web --> API
\`\`\`

## Notes

- API owns authentication
- DB stores workspaces
`);

    expect(document.title).toBe("Project map");
    expect(document.mermaidBlockCount).toBe(1);
    expect(document.sections).toHaveLength(2);
    expect(document.sections[0]?.blocks).toEqual([
      { type: "text", text: "Short project context.", variant: "body" },
      {
        type: "mermaid",
        source: "flowchart LR\n  Web --> API",
      },
    ]);
    expect(document.sections[1]).toMatchObject({
      title: "Notes",
      blocks: [
        {
          type: "text",
          text: "• API owns authentication\n• DB stores workspaces",
          variant: "body",
        },
      ],
    });
  });

  it("does not treat ordinary code blocks as Mermaid", () => {
    const document = parseDrawDocument(`## Implementation

\`\`\`ts
const ready = true;
\`\`\`
`);

    expect(document.mermaidBlockCount).toBe(0);
    expect(document.sections[0]?.blocks[0]).toEqual({
      type: "text",
      text: "const ready = true;",
      variant: "code",
    });
  });

  it("lays sections beside each other without overlapping", async () => {
    const document = parseDrawDocument(`# System

\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`

## Runtime

\`\`\`mermaid
flowchart TD
  C --> D
\`\`\`
`);
    const rendered = await createDrawDocumentElements({
      document,
      origin: { x: 100, y: 200 },
      source: { sourceId: "project-one", hash: "content-one" },
      parseMermaid: async () => ({
        elements: [{ type: "rectangle", x: 0, y: 0, width: 240, height: 120 }],
        files: {},
      }),
    });

    const frames = rendered.elements.filter(
      (element) => element.type === "frame",
    );
    expect(frames).toHaveLength(2);
    expect(frames[1]!.x).toBeGreaterThan(frames[0]!.x + frames[0]!.width);
    expect(
      rendered.elements
        .filter((element) => element.type !== "frame")
        .every((element) =>
          frames.some((frame) => frame.id === element.frameId),
        ),
    ).toBe(true);
    expect(getDrawDocumentMetadata(frames[0]!)).toMatchObject({
      sourceId: "project-one",
      hash: "content-one",
      rendererVersion: 3,
    });
    const generatedText = rendered.elements.find(
      (element) => element.type === "text",
    );
    expect(generatedText?.strokeColor).toBe("#1b1b1f");
    expect(applyDarkModeFilter(generatedText!.strokeColor, true)).not.toBe(
      generatedText?.strokeColor,
    );
  });
});
