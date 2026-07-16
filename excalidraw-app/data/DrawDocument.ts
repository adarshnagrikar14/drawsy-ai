import { FONT_FAMILY, getFontString } from "@excalidraw/common";
import {
  convertToExcalidrawElements,
  getCommonBounds,
  isFrameLikeElement,
  newElementWith,
  newFrameElement,
  newTextElement,
  wrapText,
} from "@excalidraw/element";
import { marked, type Token, type Tokens } from "marked";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { MermaidToExcalidrawResult } from "@excalidraw/mermaid-to-excalidraw/dist/interfaces";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

export type DrawDocumentBlock =
  | { type: "heading"; text: string; level: number }
  | { type: "text"; text: string; variant: "body" | "quote" | "code" }
  | { type: "mermaid"; source: string };

export type DrawDocumentSection = {
  title: string;
  blocks: DrawDocumentBlock[];
};

export type DrawDocument = {
  title: string;
  sections: DrawDocumentSection[];
  mermaidBlockCount: number;
  unsupportedBlockCount: number;
};

type DrawDocumentSource = {
  sourceId: string;
  hash: string;
};

type DrawDocumentMetadata = {
  objectType: "draw_document";
  path: "DRAW.md";
  sourceId: string;
  hash: string;
  theme: "light" | "dark";
  section: number;
};

type MermaidParser = (definition: string) => Promise<MermaidToExcalidrawResult>;

const DRAW_DOCUMENT_GAP = 180;
const FRAME_PADDING = 56;
const CONTENT_WIDTH = 720;
const BLOCK_GAP = 28;

const appendTextElement = ({
  elements,
  layout,
  text,
  fontSize,
  color,
  fontFamily,
  customData,
}: {
  elements: ExcalidrawElement[];
  layout: { cursorX: number; cursorY: number; contentMaxX: number };
  text: string;
  fontSize: number;
  color: string;
  fontFamily: typeof FONT_FAMILY[keyof typeof FONT_FAMILY];
  customData: { drawsy: DrawDocumentMetadata };
}) => {
  const wrapped = wrapText(
    text,
    getFontString({ fontFamily, fontSize }),
    CONTENT_WIDTH,
  );
  const element = newTextElement({
    text: wrapped,
    x: layout.cursorX + FRAME_PADDING,
    y: layout.cursorY,
    fontSize,
    fontFamily,
    strokeColor: color,
    backgroundColor: "transparent",
    customData,
  });
  elements.push(element);
  layout.cursorY += element.height + BLOCK_GAP;
  layout.contentMaxX = Math.max(layout.contentMaxX, element.x + element.width);
};

const stripFrontmatter = (source: string) =>
  source.replace(/^\uFEFF?---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, "");

const inlineText = (tokens: Token[] | undefined): string =>
  (tokens || [])
    .map((token) => {
      if (token.type === "br") {
        return "\n";
      }
      if (token.type === "image") {
        return token.text;
      }
      if (token.type === "link") {
        const label = inlineText(token.tokens) || token.text;
        return label === token.href ? label : `${label} (${token.href})`;
      }
      if ("tokens" in token && Array.isArray(token.tokens)) {
        return inlineText(token.tokens);
      }
      return "text" in token && typeof token.text === "string"
        ? token.text
        : "";
    })
    .join("");

const listText = (token: Tokens.List) =>
  token.items
    .map((item, index) => {
      const marker = token.ordered
        ? `${(typeof token.start === "number" ? token.start : 1) + index}.`
        : "•";
      return `${marker} ${inlineText(item.tokens).trim() || item.text.trim()}`;
    })
    .join("\n");

export const parseDrawDocument = (source: string): DrawDocument => {
  const tokens = marked.lexer(stripFrontmatter(source), { gfm: true });
  const sections: DrawDocumentSection[] = [];
  let title = "DRAW.md";
  let current: DrawDocumentSection | null = null;
  let mermaidBlockCount = 0;
  let unsupportedBlockCount = 0;

  const ensureSection = () => {
    if (!current) {
      current = { title, blocks: [] };
      sections.push(current);
    }
    return current;
  };

  for (const token of tokens) {
    if (token.type === "space" || token.type === "def") {
      continue;
    }
    if (token.type === "heading") {
      const text = inlineText(token.tokens).trim() || token.text.trim();
      if (token.depth === 1 && title === "DRAW.md" && !sections.length) {
        title = text || title;
        current = { title, blocks: [] };
        sections.push(current);
      } else if (token.depth <= 2) {
        current = { title: text || "Untitled section", blocks: [] };
        sections.push(current);
      } else {
        ensureSection().blocks.push({
          type: "heading",
          text,
          level: token.depth,
        });
      }
      continue;
    }
    if (token.type === "code") {
      if ((token.lang || "").trim().toLowerCase() === "mermaid") {
        mermaidBlockCount += 1;
        ensureSection().blocks.push({ type: "mermaid", source: token.text });
      } else {
        ensureSection().blocks.push({
          type: "text",
          text: token.text,
          variant: "code",
        });
      }
      continue;
    }
    if (token.type === "paragraph" || token.type === "text") {
      const text = inlineText(token.tokens).trim() || token.text.trim();
      if (text) {
        ensureSection().blocks.push({ type: "text", text, variant: "body" });
      }
      continue;
    }
    if (token.type === "list") {
      ensureSection().blocks.push({
        type: "text",
        text: listText(token as Tokens.List),
        variant: "body",
      });
      continue;
    }
    if (token.type === "blockquote") {
      ensureSection().blocks.push({
        type: "text",
        text: inlineText(token.tokens).trim() || token.text.trim(),
        variant: "quote",
      });
      continue;
    }
    if (token.type === "hr") {
      continue;
    }
    unsupportedBlockCount += 1;
  }

  return {
    title,
    sections: sections.filter((section) => section.blocks.length > 0),
    mermaidBlockCount,
    unsupportedBlockCount,
  };
};

const metadataFor = (
  source: DrawDocumentSource,
  section: number,
  theme: "light" | "dark",
): { drawsy: DrawDocumentMetadata } => ({
  drawsy: {
    objectType: "draw_document",
    path: "DRAW.md",
    sourceId: source.sourceId,
    hash: source.hash,
    theme,
    section,
  },
});

export const getDrawDocumentMetadata = (
  element: ExcalidrawElement,
): DrawDocumentMetadata | null => {
  const value = element.customData?.drawsy;
  return value?.objectType === "draw_document" &&
    value.path === "DRAW.md" &&
    typeof value.sourceId === "string" &&
    typeof value.hash === "string" &&
    (value.theme === "light" || value.theme === "dark")
    ? (value as DrawDocumentMetadata)
    : null;
};

export const createDrawDocumentElements = async ({
  document,
  origin,
  source,
  theme,
  parseMermaid,
}: {
  document: DrawDocument;
  origin: { x: number; y: number };
  source: DrawDocumentSource;
  theme: "light" | "dark";
  parseMermaid: MermaidParser;
}): Promise<{
  elements: ExcalidrawElement[];
  files: BinaryFiles;
  mermaidErrors: number;
}> => {
  const elements: ExcalidrawElement[] = [];
  const files: BinaryFiles = {};
  const primary = theme === "dark" ? "#f1f3f5" : "#1b1b1f";
  const secondary = theme === "dark" ? "#adb5bd" : "#5f6368";
  const frameStroke = theme === "dark" ? "#868e96" : "#9aa0a6";
  let cursorX = origin.x;
  let mermaidErrors = 0;

  for (const [sectionIndex, section] of document.sections.entries()) {
    const sectionElements: ExcalidrawElement[] = [];
    const meta = metadataFor(source, sectionIndex, theme);
    const layout = {
      cursorX,
      cursorY: origin.y + FRAME_PADDING,
      contentMaxX: cursorX + CONTENT_WIDTH,
    };

    appendTextElement({
      elements: sectionElements,
      layout,
      text: section.title,
      fontSize: 32,
      color: primary,
      fontFamily: FONT_FAMILY.Excalifont,
      customData: meta,
    });

    for (const block of section.blocks) {
      if (block.type === "heading") {
        appendTextElement({
          elements: sectionElements,
          layout,
          text: block.text,
          fontSize: 24,
          color: primary,
          fontFamily: FONT_FAMILY.Excalifont,
          customData: meta,
        });
        continue;
      }
      if (block.type === "text") {
        appendTextElement({
          elements: sectionElements,
          layout,
          text: block.variant === "quote" ? `“${block.text}”` : block.text,
          fontSize: block.variant === "code" ? 16 : 20,
          color: block.variant === "body" ? primary : secondary,
          fontFamily:
            block.variant === "code"
              ? FONT_FAMILY.Cascadia
              : FONT_FAMILY.Excalifont,
          customData: meta,
        });
        continue;
      }

      try {
        const parsed = await parseMermaid(block.source);
        const converted = convertToExcalidrawElements(parsed.elements, {
          regenerateIds: true,
        });
        if (!converted.length) {
          throw new Error("The Mermaid block produced no elements.");
        }
        Object.assign(files, parsed.files || {});
        const [minX, minY, maxX, maxY] = getCommonBounds(converted);
        const offsetX = cursorX + FRAME_PADDING - minX;
        const offsetY = layout.cursorY - minY;
        for (const element of converted) {
          const positioned = newElementWith(element, {
            x: element.x + offsetX,
            y: element.y + offsetY,
            customData: {
              ...element.customData,
              ...meta,
            },
          });
          sectionElements.push(positioned);
        }
        layout.cursorY += maxY - minY + BLOCK_GAP;
        layout.contentMaxX = Math.max(
          layout.contentMaxX,
          cursorX + FRAME_PADDING + (maxX - minX),
        );
      } catch {
        mermaidErrors += 1;
        appendTextElement({
          elements: sectionElements,
          layout,
          text: "This Mermaid block could not be rendered.",
          fontSize: 18,
          color: "#e03131",
          fontFamily: FONT_FAMILY.Excalifont,
          customData: meta,
        });
      }
    }

    const width = Math.max(
      CONTENT_WIDTH + FRAME_PADDING * 2,
      layout.contentMaxX - cursorX + FRAME_PADDING,
    );
    const height = Math.max(
      240,
      layout.cursorY - origin.y + FRAME_PADDING - BLOCK_GAP,
    );
    const frame = newFrameElement({
      x: cursorX,
      y: origin.y,
      width,
      height,
      name: section.title,
      strokeColor: frameStroke,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 2,
      roughness: 1,
      customData: meta,
    });
    const framed = sectionElements.map((element) =>
      isFrameLikeElement(element)
        ? element
        : newElementWith(element, { frameId: frame.id }),
    );
    elements.push(frame, ...framed);
    cursorX += width + DRAW_DOCUMENT_GAP;
  }

  return { elements, files, mermaidErrors };
};
