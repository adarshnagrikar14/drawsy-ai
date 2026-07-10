import { FONT_FAMILY, MIME_TYPES, randomId } from "@excalidraw/common";
import {
  generateIdFromFile,
  getDataURL,
} from "@excalidraw/excalidraw/data/blob";
import {
  newArrowElement,
  newElement,
  newFrameElement,
  newImageElement,
  newLinearElement,
  newTextElement,
  newElementWith,
} from "@excalidraw/element";
import { pointFrom, type LocalPoint, type Radians } from "@excalidraw/math";
import { unzipSync } from "fflate";

import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
} from "@excalidraw/element/types";
import type { BinaryFileData } from "@excalidraw/excalidraw/types";

const PRESENTATION_NAMESPACE =
  "http://schemas.openxmlformats.org/presentationml/2006/main";
const DRAWING_NAMESPACE =
  "http://schemas.openxmlformats.org/drawingml/2006/main";
const RELATIONSHIP_NAMESPACE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const CHART_NAMESPACE =
  "http://schemas.openxmlformats.org/drawingml/2006/chart";

const EMU_PER_INCH = 914400;
const PX_PER_INCH = 96;
const MAX_PPTX_BYTES = 50 * 1024 * 1024;
const MAX_PPTX_ENTRIES = 2500;
const MAX_UNCOMPRESSED_PPTX_BYTES = 180 * 1024 * 1024;
const MAX_SLIDES = 200;
const MAX_ELEMENTS_PER_SLIDE = 1500;
const SLIDE_GAP = 160;

type PptxTheme = Record<string, string>;

type PptxRelationship = {
  target: string;
  targetMode: string | null;
  type: string;
};

type PptxArchive = Record<string, Uint8Array>;

type Matrix = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

type PptxTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: Radians;
  flipHorizontal: boolean;
  flipVertical: boolean;
};

type PptxColor = {
  color: string;
  opacity: number;
};

type PptxShapeStyle = {
  fill: PptxColor | null;
  stroke: PptxColor | null;
  strokeWidth: number;
  strokeStyle: "solid" | "dashed" | "dotted";
};

type PptxImportContext = {
  archive: PptxArchive;
  decoder: TextDecoder;
  theme: PptxTheme;
  files: BinaryFileData[];
  importedMedia: Map<string, BinaryFileData>;
  unsupported: Map<string, number>;
  flattened: Map<string, number>;
};

type PptxSlideContext = {
  frame: ExcalidrawFrameLikeElement;
  relationships: Map<string, PptxRelationship>;
  layout: Document | null;
  master: Document | null;
  matrix: Matrix;
  groupIds: readonly string[];
  elements: ExcalidrawElement[];
  elementCount: number;
  theme: PptxTheme;
};

export type PptxImportResult = {
  elements: ExcalidrawElement[];
  files: BinaryFileData[];
  slideCount: number;
  unsupported: Record<string, number>;
  flattened: Record<string, number>;
};

export type PptxImportOptions = {
  origin: { x: number; y: number };
};

const identityMatrix = (): Matrix => ({
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0,
});

const multiplyMatrices = (first: Matrix, second: Matrix): Matrix => ({
  a: first.a * second.a + first.c * second.b,
  b: first.b * second.a + first.d * second.b,
  c: first.a * second.c + first.c * second.d,
  d: first.b * second.c + first.d * second.d,
  e: first.a * second.e + first.c * second.f + first.e,
  f: first.b * second.e + first.d * second.f + first.f,
});

const translateMatrix = (x: number, y: number): Matrix => ({
  ...identityMatrix(),
  e: x,
  f: y,
});

const scaleMatrix = (x: number, y: number): Matrix => ({
  ...identityMatrix(),
  a: x,
  d: y,
});

const rotateMatrix = (radians: number): Matrix => ({
  a: Math.cos(radians),
  b: Math.sin(radians),
  c: -Math.sin(radians),
  d: Math.cos(radians),
  e: 0,
  f: 0,
});

const applyMatrix = (matrix: Matrix, x: number, y: number) => ({
  x: matrix.a * x + matrix.c * y + matrix.e,
  y: matrix.b * x + matrix.d * y + matrix.f,
});

const toPixels = (value: string | null | undefined) =>
  (Number(value || 0) / EMU_PER_INCH) * PX_PER_INCH;

const asNumber = (value: string | null | undefined, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const radians = (value: number) => value as Radians;

const childElements = (element: Element | Document) =>
  Array.from(element.children) as Element[];

const isElement = (element: Element, namespace: string, localName: string) =>
  element.namespaceURI === namespace && element.localName === localName;

const getChild = (
  element: Element | Document | null | undefined,
  namespace: string,
  localName: string,
) =>
  element
    ? childElements(element).find((child) =>
        isElement(child, namespace, localName),
      ) || null
    : null;

const getDescendants = (
  element: Element | Document | null | undefined,
  namespace: string,
  localName: string,
) =>
  element
    ? (Array.from(
        element.getElementsByTagNameNS(namespace, localName),
      ) as Element[])
    : [];

const getAttribute = (
  element: Element | null | undefined,
  name: string,
  namespace?: string,
) => {
  if (!element) {
    return null;
  }
  return namespace
    ? element.getAttributeNS(namespace, name)
    : element.getAttribute(name);
};

const parseXml = (value: string, partName: string) => {
  const document = new DOMParser().parseFromString(value, "application/xml");
  if (document.getElementsByTagName("parsererror").length) {
    throw new Error(`The PPTX contains invalid XML in ${partName}.`);
  }
  return document;
};

const getArchiveText = (
  archive: PptxArchive,
  decoder: TextDecoder,
  partName: string,
) => {
  const bytes = archive[partName];
  if (!bytes) {
    return null;
  }
  return decoder.decode(bytes);
};

const getArchiveXml = (
  archive: PptxArchive,
  decoder: TextDecoder,
  partName: string,
) => {
  const value = getArchiveText(archive, decoder, partName);
  return value ? parseXml(value, partName) : null;
};

const normalizeArchivePath = (path: string) => {
  const segments: string[] = [];
  for (const segment of path.replace(/\\/g, "/").split("/")) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join("/");
};

const resolvePartTarget = (partName: string, target: string) => {
  const directory = partName.slice(
    0,
    Math.max(0, partName.lastIndexOf("/") + 1),
  );
  return normalizeArchivePath(`${directory}${target}`);
};

const getRelationshipsPartName = (partName: string) => {
  const slashIndex = partName.lastIndexOf("/");
  const directory = slashIndex >= 0 ? partName.slice(0, slashIndex) : "";
  const basename = slashIndex >= 0 ? partName.slice(slashIndex + 1) : partName;
  return `${directory ? `${directory}/` : ""}_rels/${basename}.rels`;
};

const parseRelationships = (document: Document, partName: string) => {
  const relationships = new Map<string, PptxRelationship>();
  for (const relationship of getDescendants(
    document,
    "http://schemas.openxmlformats.org/package/2006/relationships",
    "Relationship",
  )) {
    const id = getAttribute(relationship, "Id");
    const target = getAttribute(relationship, "Target");
    const type = getAttribute(relationship, "Type");
    if (!id || !target || !type) {
      continue;
    }
    relationships.set(id, {
      target: resolvePartTarget(partName, target),
      targetMode: getAttribute(relationship, "TargetMode"),
      type,
    });
  }
  return relationships;
};

const getPartRelationships = (
  archive: PptxArchive,
  decoder: TextDecoder,
  partName: string,
) => {
  const relationshipsPart = getArchiveXml(
    archive,
    decoder,
    getRelationshipsPartName(partName),
  );
  return relationshipsPart
    ? parseRelationships(relationshipsPart, partName)
    : new Map<string, PptxRelationship>();
};

const increment = (map: Map<string, number>, key: string) =>
  map.set(key, (map.get(key) || 0) + 1);

const toRecord = (map: Map<string, number>) =>
  Object.fromEntries(map.entries());

const readUint16 = (bytes: Uint8Array, offset: number) =>
  bytes[offset] | (bytes[offset + 1] << 8);

const readUint32 = (bytes: Uint8Array, offset: number) =>
  (bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) >>>
  0;

const validateZipEnvelope = (bytes: Uint8Array) => {
  if (bytes.byteLength < 22 || bytes.byteLength > MAX_PPTX_BYTES) {
    throw new Error("Choose a PPTX file up to 50 MB.");
  }

  let endOffset = -1;
  const searchStart = Math.max(0, bytes.length - 0xffff - 22);
  for (let offset = bytes.length - 22; offset >= searchStart; offset--) {
    if (
      readUint32(bytes, offset) === 0x06054b50 &&
      offset + 22 + readUint16(bytes, offset + 20) === bytes.length
    ) {
      endOffset = offset;
      break;
    }
  }

  if (endOffset < 0) {
    throw new Error("The selected file is not a valid PPTX package.");
  }

  const entryCount = readUint16(bytes, endOffset + 10);
  const directoryOffset = readUint32(bytes, endOffset + 16);
  if (entryCount === 0xffff || directoryOffset === 0xffffffff) {
    throw new Error("Zip64 PPTX files are not supported yet.");
  }
  if (entryCount > MAX_PPTX_ENTRIES || directoryOffset >= bytes.length) {
    throw new Error("The PPTX contains too many package entries.");
  }

  let offset = directoryOffset;
  let uncompressedBytes = 0;
  for (let index = 0; index < entryCount; index++) {
    if (
      offset + 46 > bytes.length ||
      readUint32(bytes, offset) !== 0x02014b50
    ) {
      throw new Error("The PPTX package directory is invalid.");
    }
    const compressedSize = readUint32(bytes, offset + 20);
    const uncompressedSize = readUint32(bytes, offset + 24);
    const fileNameLength = readUint16(bytes, offset + 28);
    const extraLength = readUint16(bytes, offset + 30);
    const commentLength = readUint16(bytes, offset + 32);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new Error("Zip64 PPTX files are not supported yet.");
    }
    uncompressedBytes += uncompressedSize;
    if (uncompressedBytes > MAX_UNCOMPRESSED_PPTX_BYTES) {
      throw new Error("The PPTX expands beyond the safe 180 MB import limit.");
    }
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
};

const getThemeColor = (
  element: Element,
  theme: PptxTheme,
): PptxColor | null => {
  const srgb = getChild(element, DRAWING_NAMESPACE, "srgbClr");
  const system = getChild(element, DRAWING_NAMESPACE, "sysClr");
  const scheme = getChild(element, DRAWING_NAMESPACE, "schemeClr");
  const colorElement = srgb || system || scheme;
  if (!colorElement) {
    return null;
  }

  const raw = srgb
    ? getAttribute(srgb, "val")
    : system
    ? getAttribute(system, "lastClr") || getAttribute(system, "val")
    : theme[getAttribute(scheme, "val") || ""];
  if (!raw) {
    return null;
  }

  let red = Number.parseInt(raw.slice(0, 2), 16);
  let green = Number.parseInt(raw.slice(2, 4), 16);
  let blue = Number.parseInt(raw.slice(4, 6), 16);
  if (![red, green, blue].every(Number.isFinite)) {
    return null;
  }

  let opacity = 100;
  for (const transform of childElements(colorElement)) {
    const value =
      clamp(asNumber(getAttribute(transform, "val"), 100000), 0, 100000) /
      100000;
    if (transform.localName === "alpha") {
      opacity *= value;
    } else if (transform.localName === "tint") {
      red += (255 - red) * value;
      green += (255 - green) * value;
      blue += (255 - blue) * value;
    } else if (transform.localName === "shade") {
      red *= value;
      green *= value;
      blue *= value;
    } else if (transform.localName === "lumMod") {
      red *= value;
      green *= value;
      blue *= value;
    }
  }

  return {
    color: `#${[red, green, blue]
      .map((channel) =>
        Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, "0"),
      )
      .join("")}`,
    opacity: clamp(Math.round(opacity * 100), 0, 100),
  };
};

const getSolidFill = (element: Element | null, theme: PptxTheme) => {
  if (!element || getChild(element, DRAWING_NAMESPACE, "noFill")) {
    return null;
  }
  const solid = getChild(element, DRAWING_NAMESPACE, "solidFill");
  if (solid) {
    return getThemeColor(solid, theme);
  }
  const gradientStop = getDescendants(element, DRAWING_NAMESPACE, "gs")[0];
  return gradientStop ? getThemeColor(gradientStop, theme) : null;
};

const getShapeStyle = (
  shapeProperties: Element | null,
  theme: PptxTheme,
  flattened: Map<string, number>,
  shapeStyle?: Element | null,
): PptxShapeStyle => {
  const fillReference = getChild(shapeStyle, DRAWING_NAMESPACE, "fillRef");
  const lineReference = getChild(shapeStyle, DRAWING_NAMESPACE, "lnRef");
  const hasNoFill = !!getChild(shapeProperties, DRAWING_NAMESPACE, "noFill");
  const line = getChild(shapeProperties, DRAWING_NAMESPACE, "ln");
  const hasNoLine = !!getChild(line, DRAWING_NAMESPACE, "noFill");
  const fill = hasNoFill
    ? null
    : getSolidFill(shapeProperties, theme) ||
      (fillReference ? getThemeColor(fillReference, theme) : null);
  if (
    shapeProperties &&
    getChild(shapeProperties, DRAWING_NAMESPACE, "gradFill")
  ) {
    increment(flattened, "gradient fills");
  }
  const stroke = hasNoLine
    ? null
    : (line ? getSolidFill(line, theme) : null) ||
      (lineReference ? getThemeColor(lineReference, theme) : null);
  const dash = getChild(line, DRAWING_NAMESPACE, "prstDash");
  const dashValue = getAttribute(dash, "val") || "solid";
  const strokeStyle = dashValue.includes("dot")
    ? "dotted"
    : dashValue === "solid"
    ? "solid"
    : "dashed";
  const strokeWidth = line
    ? clamp(toPixels(getAttribute(line, "w")) * 0.75, 1, 8)
    : 1;

  return { fill, stroke, strokeWidth, strokeStyle };
};

const getTransform = (element: Element | null): PptxTransform | null => {
  const transform =
    element?.localName === "xfrm"
      ? element
      : getChild(element, DRAWING_NAMESPACE, "xfrm");
  if (!transform) {
    return null;
  }
  const offset = getChild(transform, DRAWING_NAMESPACE, "off");
  const extent = getChild(transform, DRAWING_NAMESPACE, "ext");
  if (!extent) {
    return null;
  }
  return {
    x: toPixels(getAttribute(offset, "x")),
    y: toPixels(getAttribute(offset, "y")),
    width: Math.max(0, toPixels(getAttribute(extent, "cx"))),
    height: Math.max(0, toPixels(getAttribute(extent, "cy"))),
    rotation: radians(
      (asNumber(getAttribute(transform, "rot")) / 60000 / 180) * Math.PI,
    ),
    flipHorizontal:
      getAttribute(transform, "flipH") === "1" ||
      getAttribute(transform, "flipH") === "true",
    flipVertical:
      getAttribute(transform, "flipV") === "1" ||
      getAttribute(transform, "flipV") === "true",
  };
};

const getShapeMatrix = (transform: PptxTransform) => {
  const centerX = transform.width / 2;
  const centerY = transform.height / 2;
  return [
    translateMatrix(transform.x, transform.y),
    translateMatrix(centerX, centerY),
    rotateMatrix(transform.rotation),
    scaleMatrix(
      transform.flipHorizontal ? -1 : 1,
      transform.flipVertical ? -1 : 1,
    ),
    translateMatrix(-centerX, -centerY),
  ].reduce(multiplyMatrices);
};

const getGroupMatrix = (element: Element | null) => {
  const transform = getChild(element, DRAWING_NAMESPACE, "xfrm");
  if (!transform) {
    return identityMatrix();
  }
  const offset = getChild(transform, DRAWING_NAMESPACE, "off");
  const extent = getChild(transform, DRAWING_NAMESPACE, "ext");
  const childOffset = getChild(transform, DRAWING_NAMESPACE, "chOff");
  const childExtent = getChild(transform, DRAWING_NAMESPACE, "chExt");
  const width = toPixels(getAttribute(extent, "cx"));
  const height = toPixels(getAttribute(extent, "cy"));
  const childWidth = toPixels(getAttribute(childExtent, "cx")) || width || 1;
  const childHeight = toPixels(getAttribute(childExtent, "cy")) || height || 1;
  const x = toPixels(getAttribute(offset, "x"));
  const y = toPixels(getAttribute(offset, "y"));
  const childX = toPixels(getAttribute(childOffset, "x"));
  const childY = toPixels(getAttribute(childOffset, "y"));
  const rotation = radians(
    (asNumber(getAttribute(transform, "rot")) / 60000 / 180) * Math.PI,
  );
  const flipHorizontal =
    getAttribute(transform, "flipH") === "1" ||
    getAttribute(transform, "flipH") === "true";
  const flipVertical =
    getAttribute(transform, "flipV") === "1" ||
    getAttribute(transform, "flipV") === "true";

  return [
    translateMatrix(x, y),
    translateMatrix(width / 2, height / 2),
    rotateMatrix(rotation),
    scaleMatrix(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1),
    translateMatrix(-width / 2, -height / 2),
    scaleMatrix(width / childWidth, height / childHeight),
    translateMatrix(-childX, -childY),
  ].reduce(multiplyMatrices);
};

const getTransformedBox = (matrix: Matrix, transform: PptxTransform) => {
  const elementMatrix = multiplyMatrices(matrix, getShapeMatrix(transform));
  const topLeft = applyMatrix(elementMatrix, 0, 0);
  const horizontal = applyMatrix(elementMatrix, transform.width, 0);
  const vertical = applyMatrix(elementMatrix, 0, transform.height);
  const center = applyMatrix(
    elementMatrix,
    transform.width / 2,
    transform.height / 2,
  );
  const width = Math.hypot(horizontal.x - topLeft.x, horizontal.y - topLeft.y);
  const height = Math.hypot(vertical.x - topLeft.x, vertical.y - topLeft.y);
  return {
    matrix: elementMatrix,
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
    angle: radians(
      Math.atan2(horizontal.y - topLeft.y, horizontal.x - topLeft.x),
    ),
  };
};

const getText = (textBody: Element | null) => {
  if (!textBody) {
    return "";
  }
  const paragraphs = childElements(textBody).filter((element) =>
    isElement(element, DRAWING_NAMESPACE, "p"),
  );
  return (
    paragraphs.length
      ? paragraphs
      : getDescendants(textBody, DRAWING_NAMESPACE, "p")
  )
    .map((paragraph) => {
      const bullet =
        !!getDescendants(paragraph, DRAWING_NAMESPACE, "buChar").length ||
        !!getDescendants(paragraph, DRAWING_NAMESPACE, "buAutoNum").length;
      const content = childElements(paragraph)
        .map((item) => {
          if (isElement(item, DRAWING_NAMESPACE, "br")) {
            return "\n";
          }
          return getDescendants(item, DRAWING_NAMESPACE, "t")
            .map((text) => text.textContent || "")
            .join("");
        })
        .join("");
      return `${bullet && content ? "• " : ""}${content}`.replace(/\n+$/g, "");
    })
    .join("\n")
    .trim();
};

const getTextStyle = (
  textBody: Element | null,
  shapeProperties: Element | null,
  theme: PptxTheme,
  shapeStyle?: Element | null,
) => {
  const paragraph =
    getChild(textBody, DRAWING_NAMESPACE, "p") ||
    getDescendants(textBody, DRAWING_NAMESPACE, "p")[0] ||
    null;
  const runProperties =
    getDescendants(paragraph, DRAWING_NAMESPACE, "rPr")[0] ||
    getDescendants(paragraph, DRAWING_NAMESPACE, "defRPr")[0] ||
    getDescendants(paragraph, DRAWING_NAMESPACE, "endParaRPr")[0] ||
    null;
  const paragraphProperties = getChild(paragraph, DRAWING_NAMESPACE, "pPr");
  const bodyProperties = getChild(textBody, DRAWING_NAMESPACE, "bodyPr");
  const fontReference = getChild(shapeStyle, DRAWING_NAMESPACE, "fontRef");
  const color =
    getSolidFill(runProperties, theme)?.color ||
    (fontReference ? getThemeColor(fontReference, theme)?.color : null) ||
    getSolidFill(shapeProperties, theme)?.color ||
    "#1f1f1f";
  const size = clamp(
    (asNumber(getAttribute(runProperties, "sz"), 1800) / 100) * (4 / 3),
    10,
    160,
  );
  const alignment = getAttribute(paragraphProperties, "algn");
  const textAlign =
    alignment === "ctr" ? "center" : alignment === "r" ? "right" : "left";
  const anchor = getAttribute(bodyProperties, "anchor");
  const verticalAlign = anchor === "ctr" || anchor === "mid" ? "middle" : "top";
  return { color, size, textAlign, verticalAlign } as const;
};

const findPlaceholder = (
  shape: Element,
  layout: Document | null,
  master: Document | null,
) => {
  const placeholder = getChild(
    getChild(shape, PRESENTATION_NAMESPACE, "nvSpPr"),
    PRESENTATION_NAMESPACE,
    "nvPr",
  );
  const sourcePlaceholder = getChild(placeholder, PRESENTATION_NAMESPACE, "ph");
  if (!sourcePlaceholder) {
    return null;
  }
  const index = getAttribute(sourcePlaceholder, "idx");
  const type = getAttribute(sourcePlaceholder, "type") || "body";
  for (const source of [layout, master]) {
    for (const candidate of getDescendants(
      source,
      PRESENTATION_NAMESPACE,
      "sp",
    )) {
      const candidatePlaceholder = getChild(
        getChild(candidate, PRESENTATION_NAMESPACE, "nvSpPr"),
        PRESENTATION_NAMESPACE,
        "nvPr",
      );
      const candidatePh = getChild(
        candidatePlaceholder,
        PRESENTATION_NAMESPACE,
        "ph",
      );
      if (!candidatePh) {
        continue;
      }
      if (index && getAttribute(candidatePh, "idx") === index) {
        return candidate;
      }
      if (!index && (getAttribute(candidatePh, "type") || "body") === type) {
        return candidate;
      }
    }
  }
  return null;
};

const addElement = (context: PptxSlideContext, element: ExcalidrawElement) => {
  if (context.elementCount >= MAX_ELEMENTS_PER_SLIDE) {
    return false;
  }
  context.elements.push(element);
  context.elementCount += 1;
  return true;
};

const toExcalidrawStrokeWidth = (value: number) =>
  value <= 1.5 ? 1 : value <= 3 ? 2 : value <= 6 ? 4 : 8;

const getLineArrowhead = (lineEnd: Element | null) => {
  const type = getAttribute(lineEnd, "type");
  if (!type || type === "none") {
    return null;
  }
  if (type === "oval") {
    return "circle" as const;
  }
  if (type === "diamond") {
    return "diamond" as const;
  }
  return "arrow" as const;
};

const addShapeText = (
  context: PptxSlideContext,
  textBody: Element | null,
  shapeProperties: Element | null,
  shapeStyle: Element | null,
  transformed: ReturnType<typeof getTransformedBox>,
) => {
  const text = getText(textBody);
  if (!text) {
    return;
  }
  const style = getTextStyle(
    textBody,
    shapeProperties,
    context.theme,
    shapeStyle,
  );
  const horizontalInset = Math.min(12, transformed.width * 0.06);
  const verticalInset = Math.min(10, transformed.height * 0.06);
  const element = newElementWith(
    newTextElement({
      x:
        style.textAlign === "center"
          ? transformed.x + transformed.width / 2
          : style.textAlign === "right"
          ? transformed.x + transformed.width - horizontalInset
          : transformed.x + horizontalInset,
      y:
        style.verticalAlign === "middle"
          ? transformed.y + transformed.height / 2
          : transformed.y + verticalInset,
      text,
      originalText: text,
      fontSize: style.size,
      fontFamily: FONT_FAMILY.Helvetica,
      textAlign: style.textAlign,
      verticalAlign: style.verticalAlign,
      autoResize: false,
      width: Math.max(1, transformed.width - horizontalInset * 2),
      height: Math.max(
        style.size * 1.2,
        transformed.height - verticalInset * 2,
      ),
      strokeColor: style.color,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      roughness: 0,
      angle: transformed.angle,
      frameId: context.frame.id,
      groupIds: context.groupIds,
    }),
    {
      width: Math.max(1, transformed.width - horizontalInset * 2),
      height: Math.max(
        style.size * 1.2,
        transformed.height - verticalInset * 2,
      ),
    },
  );
  addElement(context, element);
};

const addShape = (
  shape: Element,
  context: PptxSlideContext,
  importContext: PptxImportContext,
) => {
  const shapeProperties = getChild(shape, PRESENTATION_NAMESPACE, "spPr");
  const placeholder = findPlaceholder(shape, context.layout, context.master);
  const placeholderProperties = getChild(
    placeholder,
    PRESENTATION_NAMESPACE,
    "spPr",
  );
  const transform =
    getTransform(shapeProperties) || getTransform(placeholderProperties);
  const textBody = getChild(shape, PRESENTATION_NAMESPACE, "txBody");
  if (!transform || !transform.width || !transform.height) {
    if (getText(textBody)) {
      increment(importContext.unsupported, "unpositioned text placeholders");
    }
    return;
  }
  const transformed = getTransformedBox(context.matrix, transform);
  const shapeStyle = getChild(shape, PRESENTATION_NAMESPACE, "style");
  const style = getShapeStyle(
    shapeProperties || placeholderProperties,
    importContext.theme,
    importContext.flattened,
    shapeStyle,
  );
  const geometry = getAttribute(
    getChild(
      shapeProperties || placeholderProperties,
      DRAWING_NAMESPACE,
      "prstGeom",
    ),
    "prst",
  );
  if (geometry === "line") {
    const start = applyMatrix(transformed.matrix, 0, 0);
    const end = applyMatrix(
      transformed.matrix,
      transform.width,
      transform.height,
    );
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    addElement(
      context,
      newLinearElement({
        type: "line",
        x,
        y,
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
        points: [
          pointFrom<LocalPoint>(start.x - x, start.y - y),
          pointFrom<LocalPoint>(end.x - x, end.y - y),
        ],
        strokeColor: style.stroke?.color || "#1f1f1f",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: toExcalidrawStrokeWidth(style.strokeWidth),
        strokeStyle: style.strokeStyle,
        roughness: 0,
        opacity: style.stroke?.opacity || 100,
        frameId: context.frame.id,
        groupIds: context.groupIds,
      }),
    );
    addShapeText(
      context,
      textBody,
      shapeProperties || placeholderProperties,
      shapeStyle,
      transformed,
    );
    return;
  }
  const hasVisibleShape = !!style.fill || !!style.stroke;
  if (hasVisibleShape) {
    const type =
      geometry === "ellipse"
        ? "ellipse"
        : geometry === "diamond"
        ? "diamond"
        : "rectangle";
    addElement(
      context,
      newElement({
        type,
        x: transformed.x,
        y: transformed.y,
        width: Math.max(1, transformed.width),
        height: Math.max(1, transformed.height),
        angle: transformed.angle,
        strokeColor: style.stroke?.color || "transparent",
        backgroundColor: style.fill?.color || "transparent",
        fillStyle: "solid",
        strokeWidth: toExcalidrawStrokeWidth(style.strokeWidth),
        strokeStyle: style.strokeStyle,
        roughness: 0,
        opacity: Math.min(
          style.fill?.opacity || 100,
          style.stroke?.opacity || 100,
        ),
        frameId: context.frame.id,
        groupIds: context.groupIds,
      }),
    );
  }
  addShapeText(
    context,
    textBody,
    shapeProperties || placeholderProperties,
    shapeStyle,
    transformed,
  );
};

const addConnector = (
  connector: Element,
  context: PptxSlideContext,
  importContext: PptxImportContext,
) => {
  const shapeProperties = getChild(connector, PRESENTATION_NAMESPACE, "spPr");
  const transform = getTransform(shapeProperties);
  if (!transform) {
    increment(importContext.unsupported, "unpositioned connectors");
    return;
  }
  const matrix = multiplyMatrices(context.matrix, getShapeMatrix(transform));
  const start = applyMatrix(matrix, 0, 0);
  const end = applyMatrix(matrix, transform.width, transform.height);
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const style = getShapeStyle(
    shapeProperties,
    importContext.theme,
    importContext.flattened,
  );
  const lineProperties = getChild(shapeProperties, DRAWING_NAMESPACE, "ln");
  const startArrowhead = getLineArrowhead(
    getChild(lineProperties, DRAWING_NAMESPACE, "headEnd"),
  );
  const endArrowhead = getLineArrowhead(
    getChild(lineProperties, DRAWING_NAMESPACE, "tailEnd"),
  );
  const points = [
    pointFrom<LocalPoint>(start.x - x, start.y - y),
    pointFrom<LocalPoint>(end.x - x, end.y - y),
  ];
  const options = {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
    points,
    strokeColor: style.stroke?.color || "#1f1f1f",
    backgroundColor: "transparent",
    fillStyle: "solid" as const,
    strokeWidth: toExcalidrawStrokeWidth(style.strokeWidth),
    strokeStyle: style.strokeStyle,
    roughness: 0,
    opacity: style.stroke?.opacity || 100,
    frameId: context.frame.id,
    groupIds: context.groupIds,
  };
  addElement(
    context,
    startArrowhead || endArrowhead
      ? newArrowElement({
          type: "arrow",
          ...options,
          startArrowhead,
          endArrowhead,
        })
      : newLinearElement({ type: "line", ...options }),
  );
};

const getImageMimeType = (partName: string) => {
  const extension = partName.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, BinaryFileData["mimeType"]> = {
    png: MIME_TYPES.png,
    jpg: MIME_TYPES.jpg,
    jpeg: MIME_TYPES.jpg,
    gif: MIME_TYPES.gif,
    webp: MIME_TYPES.webp,
    svg: MIME_TYPES.svg,
    bmp: MIME_TYPES.bmp,
  };
  return extension ? mimeTypes[extension] || null : null;
};

const addPicture = async (
  picture: Element,
  context: PptxSlideContext,
  importContext: PptxImportContext,
) => {
  const shapeProperties = getChild(picture, PRESENTATION_NAMESPACE, "spPr");
  const transform = getTransform(shapeProperties);
  const blip = getDescendants(picture, DRAWING_NAMESPACE, "blip")[0];
  const relationshipId = getAttribute(blip, "embed", RELATIONSHIP_NAMESPACE);
  const relationship = relationshipId
    ? context.relationships.get(relationshipId)
    : null;
  if (!transform || !relationship || relationship.targetMode === "External") {
    increment(importContext.unsupported, "external or unlinked images");
    return;
  }
  const bytes = importContext.archive[relationship.target];
  const mimeType = getImageMimeType(relationship.target);
  if (!bytes || !mimeType) {
    increment(importContext.unsupported, "unsupported image formats");
    return;
  }
  let binary = importContext.importedMedia.get(relationship.target);
  if (!binary) {
    const imageBytes = new Uint8Array(bytes.byteLength);
    imageBytes.set(bytes);
    const file = new File(
      [imageBytes.buffer],
      relationship.target.split("/").pop() || "image",
      { type: mimeType },
    );
    binary = {
      id: await generateIdFromFile(file),
      mimeType,
      dataURL: await getDataURL(file),
      created: Date.now(),
    };
    importContext.importedMedia.set(relationship.target, binary);
    importContext.files.push(binary);
  }
  const transformed = getTransformedBox(context.matrix, transform);
  addElement(
    context,
    newImageElement({
      type: "image",
      x: transformed.x,
      y: transformed.y,
      width: Math.max(1, transformed.width),
      height: Math.max(1, transformed.height),
      angle: transformed.angle,
      fileId: binary.id,
      status: "saved",
      scale: [
        transform.flipHorizontal ? -1 : 1,
        transform.flipVertical ? -1 : 1,
      ],
      frameId: context.frame.id,
      groupIds: context.groupIds,
      strokeColor: "transparent",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      roughness: 0,
    }),
  );
};

const addTable = (
  table: Element,
  transform: PptxTransform,
  context: PptxSlideContext,
  importContext: PptxImportContext,
) => {
  const tableMatrix = multiplyMatrices(
    context.matrix,
    getShapeMatrix(transform),
  );
  const columns = getDescendants(
    getChild(table, DRAWING_NAMESPACE, "tblGrid"),
    DRAWING_NAMESPACE,
    "gridCol",
  );
  const rows = childElements(table).filter((element) =>
    isElement(element, DRAWING_NAMESPACE, "tr"),
  );
  if (!columns.length || !rows.length) {
    increment(importContext.unsupported, "empty tables");
    return;
  }
  const columnTotal = columns.reduce(
    (sum, column) => sum + Math.max(1, toPixels(getAttribute(column, "w"))),
    0,
  );
  const rowTotal = rows.reduce(
    (sum, row) => sum + Math.max(1, toPixels(getAttribute(row, "h"))),
    0,
  );
  let y = 0;
  for (const row of rows) {
    const rowHeight =
      (Math.max(1, toPixels(getAttribute(row, "h"))) / rowTotal) *
      transform.height;
    let x = 0;
    const cells = childElements(row).filter((element) =>
      isElement(element, DRAWING_NAMESPACE, "tc"),
    );
    for (let index = 0; index < columns.length; index++) {
      const width =
        (Math.max(1, toPixels(getAttribute(columns[index], "w"))) /
          columnTotal) *
        transform.width;
      const cell = cells[index];
      const cellProperties = getChild(cell, DRAWING_NAMESPACE, "tcPr");
      const fill = getSolidFill(cellProperties, importContext.theme);
      const cellTransform: PptxTransform = {
        x,
        y,
        width,
        height: rowHeight,
        rotation: radians(0),
        flipHorizontal: false,
        flipVertical: false,
      };
      const cellBox = getTransformedBox(tableMatrix, cellTransform);
      addElement(
        context,
        newElement({
          type: "rectangle",
          x: cellBox.x,
          y: cellBox.y,
          width: cellBox.width,
          height: cellBox.height,
          angle: cellBox.angle,
          strokeColor: "#868e96",
          backgroundColor: fill?.color || "transparent",
          fillStyle: "solid",
          strokeWidth: 1,
          roughness: 0,
          opacity: fill?.opacity || 100,
          frameId: context.frame.id,
          groupIds: context.groupIds,
        }),
      );
      const text = cell ? getText(cell) : "";
      if (text) {
        const textElement = newElementWith(
          newTextElement({
            x: cellBox.x + 8,
            y: cellBox.y + 8,
            text,
            originalText: text,
            fontSize: 18,
            fontFamily: FONT_FAMILY.Helvetica,
            textAlign: "left",
            verticalAlign: "top",
            autoResize: false,
            width: Math.max(1, cellBox.width - 16),
            height: Math.max(18, cellBox.height - 16),
            strokeColor: "#1f1f1f",
            backgroundColor: "transparent",
            fillStyle: "solid",
            strokeWidth: 1,
            roughness: 0,
            angle: cellBox.angle,
            frameId: context.frame.id,
            groupIds: context.groupIds,
          }),
          {
            width: Math.max(1, cellBox.width - 16),
            height: Math.max(18, cellBox.height - 16),
          },
        );
        addElement(context, textElement);
      }
      x += width;
    }
    y += rowHeight;
  }
};

const getChartSeries = (chart: Document) => {
  const series = getDescendants(chart, CHART_NAMESPACE, "ser")[0];
  if (!series) {
    return [];
  }
  const labels = getDescendants(
    getChild(series, CHART_NAMESPACE, "cat"),
    CHART_NAMESPACE,
    "pt",
  ).map(
    (point) =>
      getDescendants(point, CHART_NAMESPACE, "v")[0]?.textContent?.trim() || "",
  );
  const values = getDescendants(
    getChild(series, CHART_NAMESPACE, "val"),
    CHART_NAMESPACE,
    "pt",
  ).map((point) =>
    asNumber(getDescendants(point, CHART_NAMESPACE, "v")[0]?.textContent, 0),
  );
  return values.map((value, index) => ({
    label: labels[index] || `Item ${index + 1}`,
    value,
  }));
};

const addChart = (
  chartPart: string,
  transform: PptxTransform,
  context: PptxSlideContext,
  importContext: PptxImportContext,
) => {
  const chart = getArchiveXml(
    importContext.archive,
    importContext.decoder,
    chartPart,
  );
  if (!chart) {
    increment(importContext.unsupported, "missing chart data");
    return;
  }
  const transformed = getTransformedBox(context.matrix, transform);
  const series = getChartSeries(chart);
  const chartTitle = getText(
    getDescendants(chart, CHART_NAMESPACE, "title")[0] as unknown as Element,
  );
  const chartType = [
    "barChart",
    "lineChart",
    "areaChart",
    "pieChart",
    "doughnutChart",
  ].find((type) => getDescendants(chart, CHART_NAMESPACE, type).length);
  const colors = ["#4dabf7", "#69db7c", "#ff8787", "#ffd43b", "#b197fc"];
  const titleHeight = chartTitle ? 44 : 16;
  const plotX = transformed.x + 28;
  const plotY = transformed.y + titleHeight + 16;
  const plotWidth = Math.max(80, transformed.width - 56);
  const plotHeight = Math.max(60, transformed.height - titleHeight - 54);
  const maxValue = Math.max(1, ...series.map((item) => item.value));
  if (chartTitle) {
    addElement(
      context,
      newTextElement({
        x: transformed.x + 18,
        y: transformed.y + 14,
        text: chartTitle,
        fontSize: 24,
        fontFamily: FONT_FAMILY.Helvetica,
        strokeColor: "#1f1f1f",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        roughness: 0,
        angle: transformed.angle,
        frameId: context.frame.id,
        groupIds: context.groupIds,
      }),
    );
  }
  if (!series.length) {
    increment(importContext.unsupported, "charts without cached data");
    return;
  }

  if (chartType === "lineChart" || chartType === "areaChart") {
    const points = series.map((item, index) =>
      pointFrom<LocalPoint>(
        (index / Math.max(1, series.length - 1)) * plotWidth,
        plotHeight - (item.value / maxValue) * plotHeight,
      ),
    );
    if (chartType === "areaChart") {
      const polygon = [
        pointFrom<LocalPoint>(0, plotHeight),
        ...points,
        pointFrom<LocalPoint>(plotWidth, plotHeight),
      ];
      addElement(
        context,
        newLinearElement({
          type: "line",
          x: plotX,
          y: plotY,
          width: plotWidth,
          height: plotHeight,
          points: polygon,
          polygon: true,
          strokeColor: "transparent",
          backgroundColor: "#4dabf7",
          fillStyle: "solid",
          strokeWidth: 1,
          roughness: 0,
          opacity: 45,
          frameId: context.frame.id,
          groupIds: context.groupIds,
        }),
      );
    }
    addElement(
      context,
      newLinearElement({
        type: "line",
        x: plotX,
        y: plotY,
        width: plotWidth,
        height: plotHeight,
        points,
        strokeColor: "#1971c2",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 3,
        roughness: 0,
        opacity: 100,
        frameId: context.frame.id,
        groupIds: context.groupIds,
      }),
    );
  } else {
    if (chartType === "pieChart" || chartType === "doughnutChart") {
      increment(
        importContext.flattened,
        "pie and doughnut charts converted to editable data bars",
      );
    }
    const barWidth = plotWidth / series.length;
    series.forEach((item, index) => {
      const height = (item.value / maxValue) * plotHeight;
      addElement(
        context,
        newElement({
          type: "rectangle",
          x: plotX + index * barWidth + barWidth * 0.16,
          y: plotY + plotHeight - height,
          width: barWidth * 0.68,
          height,
          strokeColor: "transparent",
          backgroundColor: colors[index % colors.length],
          fillStyle: "solid",
          strokeWidth: 1,
          roughness: 0,
          opacity: 100,
          frameId: context.frame.id,
          groupIds: context.groupIds,
        }),
      );
    });
  }
  series.forEach((item, index) => {
    addElement(
      context,
      newTextElement({
        x: plotX + (index / Math.max(1, series.length - 1)) * plotWidth,
        y: plotY + plotHeight + 12,
        text: item.label,
        fontSize: 13,
        fontFamily: FONT_FAMILY.Helvetica,
        textAlign: "center",
        strokeColor: "#495057",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        roughness: 0,
        frameId: context.frame.id,
        groupIds: context.groupIds,
      }),
    );
  });
};

const addGraphicFrame = (
  graphicFrame: Element,
  context: PptxSlideContext,
  importContext: PptxImportContext,
) => {
  const transform = getTransform(
    getChild(graphicFrame, PRESENTATION_NAMESPACE, "xfrm"),
  );
  if (!transform) {
    increment(importContext.unsupported, "unpositioned graphic frames");
    return;
  }
  const graphicData = getDescendants(
    graphicFrame,
    DRAWING_NAMESPACE,
    "graphicData",
  )[0];
  const table = getChild(graphicData, DRAWING_NAMESPACE, "tbl");
  if (table) {
    addTable(table, transform, context, importContext);
    return;
  }
  const chartReference = getDescendants(
    graphicData,
    CHART_NAMESPACE,
    "chart",
  )[0];
  const relationshipId = getAttribute(
    chartReference,
    "id",
    RELATIONSHIP_NAMESPACE,
  );
  const relationship = relationshipId
    ? context.relationships.get(relationshipId)
    : null;
  if (relationship) {
    addChart(relationship.target, transform, context, importContext);
    return;
  }
  increment(importContext.unsupported, "SmartArt or embedded objects");
};

const visitShapeTree = async (
  parent: Element,
  context: PptxSlideContext,
  importContext: PptxImportContext,
) => {
  for (const child of childElements(parent)) {
    if (
      isElement(child, PRESENTATION_NAMESPACE, "nvGrpSpPr") ||
      isElement(child, PRESENTATION_NAMESPACE, "grpSpPr")
    ) {
      continue;
    }
    if (child.localName === "AlternateContent") {
      const fallback =
        childElements(child).find((item) => item.localName === "Fallback") ||
        childElements(child)[0];
      if (fallback) {
        await visitShapeTree(fallback, context, importContext);
      }
      continue;
    }
    if (isElement(child, PRESENTATION_NAMESPACE, "grpSp")) {
      const groupProperties = getChild(
        child,
        PRESENTATION_NAMESPACE,
        "grpSpPr",
      );
      const nestedContext: PptxSlideContext = {
        ...context,
        matrix: multiplyMatrices(
          context.matrix,
          getGroupMatrix(groupProperties),
        ),
        groupIds: [...context.groupIds, randomId()],
      };
      await visitShapeTree(child, nestedContext, importContext);
      context.elementCount = nestedContext.elementCount;
      continue;
    }
    if (isElement(child, PRESENTATION_NAMESPACE, "sp")) {
      addShape(child, context, importContext);
      continue;
    }
    if (isElement(child, PRESENTATION_NAMESPACE, "cxnSp")) {
      addConnector(child, context, importContext);
      continue;
    }
    if (isElement(child, PRESENTATION_NAMESPACE, "pic")) {
      await addPicture(child, context, importContext);
      continue;
    }
    if (isElement(child, PRESENTATION_NAMESPACE, "graphicFrame")) {
      addGraphicFrame(child, context, importContext);
      continue;
    }
    if (isElement(child, PRESENTATION_NAMESPACE, "contentPart")) {
      increment(importContext.unsupported, "content parts");
    }
  }
};

const getBackgroundColor = (
  slide: Document,
  layout: Document | null,
  master: Document | null,
  theme: PptxTheme,
) => {
  for (const document of [slide, layout, master]) {
    const background = getDescendants(
      document,
      PRESENTATION_NAMESPACE,
      "bg",
    )[0];
    const backgroundProperties = getChild(
      background,
      PRESENTATION_NAMESPACE,
      "bgPr",
    );
    const fill = getSolidFill(backgroundProperties, theme);
    if (fill) {
      return fill;
    }
  }
  return { color: "#ffffff", opacity: 100 };
};

const findSlideMaster = (
  archive: PptxArchive,
  decoder: TextDecoder,
  layoutPart: string | null,
) => {
  if (!layoutPart) {
    return null;
  }
  const relationships = getPartRelationships(archive, decoder, layoutPart);
  const master = [...relationships.values()].find((relationship) =>
    relationship.type.endsWith("/slideMaster"),
  );
  return master ? getArchiveXml(archive, decoder, master.target) : null;
};

const getPresentationTheme = (archive: PptxArchive, decoder: TextDecoder) => {
  const themePart = Object.keys(archive).find((partName) =>
    /^ppt\/theme\/theme\d+\.xml$/i.test(partName),
  );
  const themeDocument = themePart
    ? getArchiveXml(archive, decoder, themePart)
    : null;
  const colors: PptxTheme = {};
  const scheme = getDescendants(
    themeDocument,
    DRAWING_NAMESPACE,
    "clrScheme",
  )[0];
  if (!scheme) {
    return colors;
  }
  for (const entry of childElements(scheme)) {
    const color = getThemeColor(entry, {});
    if (color) {
      colors[entry.localName] = color.color.slice(1).toUpperCase();
    }
  }
  return colors;
};

const getSlideSize = (presentation: Document) => {
  const size = getDescendants(presentation, PRESENTATION_NAMESPACE, "sldSz")[0];
  return {
    width: Math.max(1, toPixels(getAttribute(size, "cx")) || 960),
    height: Math.max(1, toPixels(getAttribute(size, "cy")) || 540),
  };
};

const getSlideParts = (
  archive: PptxArchive,
  decoder: TextDecoder,
  presentation: Document,
) => {
  const relationships = getPartRelationships(
    archive,
    decoder,
    "ppt/presentation.xml",
  );
  return getDescendants(presentation, PRESENTATION_NAMESPACE, "sldId")
    .map((slideId) =>
      relationships.get(
        getAttribute(slideId, "id", RELATIONSHIP_NAMESPACE) || "",
      ),
    )
    .filter(
      (relationship): relationship is PptxRelationship =>
        !!relationship && relationship.type.endsWith("/slide"),
    )
    .map((relationship) => relationship.target);
};

const assertPptxFile = (file: File) => {
  if (!/\.pptx$/i.test(file.name)) {
    throw new Error("Choose a .pptx presentation file.");
  }
};

const readFileBytes = async (file: File) => {
  if (typeof file.arrayBuffer === "function") {
    return new Uint8Array(await file.arrayBuffer());
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error || new Error("Unable to read the PPTX."));
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error("Unable to read the PPTX."));
      }
    };
    reader.readAsArrayBuffer(file);
  });
};

export const importPptxPresentation = async (
  file: File,
  options: PptxImportOptions,
): Promise<PptxImportResult> => {
  assertPptxFile(file);
  const bytes = await readFileBytes(file);
  validateZipEnvelope(bytes);

  let archive: PptxArchive;
  try {
    archive = unzipSync(bytes);
  } catch {
    throw new Error("The selected file is not a readable PPTX package.");
  }
  if (!archive["[Content_Types].xml"] || !archive["ppt/presentation.xml"]) {
    throw new Error("The selected file is not a PowerPoint presentation.");
  }
  const decoder = new TextDecoder();
  const contentTypes =
    getArchiveText(archive, decoder, "[Content_Types].xml") || "";
  if (!contentTypes.includes("presentationml.presentation.main+xml")) {
    throw new Error("The selected file is not a PowerPoint presentation.");
  }
  const presentation = getArchiveXml(archive, decoder, "ppt/presentation.xml");
  if (!presentation) {
    throw new Error("The PPTX is missing its presentation data.");
  }
  const slideParts = getSlideParts(archive, decoder, presentation);
  if (!slideParts.length) {
    throw new Error("The PPTX does not contain any slides.");
  }
  if (slideParts.length > MAX_SLIDES) {
    throw new Error("Import up to 200 slides at a time.");
  }

  const size = getSlideSize(presentation);
  const importContext: PptxImportContext = {
    archive,
    decoder,
    theme: getPresentationTheme(archive, decoder),
    files: [],
    importedMedia: new Map(),
    unsupported: new Map(),
    flattened: new Map(),
  };
  const elements: ExcalidrawElement[] = [];
  let originX = options.origin.x;

  for (const [index, slidePart] of slideParts.entries()) {
    const slide = getArchiveXml(archive, decoder, slidePart);
    if (!slide) {
      throw new Error(`Slide ${index + 1} is missing from the PPTX package.`);
    }
    const relationships = getPartRelationships(archive, decoder, slidePart);
    const layoutRelation = [...relationships.values()].find((relationship) =>
      relationship.type.endsWith("/slideLayout"),
    );
    const layout = layoutRelation
      ? getArchiveXml(archive, decoder, layoutRelation.target)
      : null;
    const master = findSlideMaster(
      archive,
      decoder,
      layoutRelation?.target || null,
    );
    const frame = newFrameElement({
      x: originX,
      y: options.origin.y,
      width: size.width,
      height: size.height,
      name: `Slide ${index + 1}`,
      strokeColor: "#868e96",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 2,
      roughness: 0,
    });
    const slideContext: PptxSlideContext = {
      frame,
      relationships,
      layout,
      master,
      matrix: translateMatrix(originX, options.origin.y),
      groupIds: [],
      elements: [],
      elementCount: 0,
      theme: importContext.theme,
    };
    const background = getBackgroundColor(
      slide,
      layout,
      master,
      importContext.theme,
    );
    elements.push(frame);
    elements.push(
      newElement({
        type: "rectangle",
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        strokeColor: "transparent",
        backgroundColor: background.color,
        fillStyle: "solid",
        strokeWidth: 1,
        roughness: 0,
        opacity: background.opacity,
        frameId: frame.id,
      }),
    );
    const shapeTree = getDescendants(
      slide,
      PRESENTATION_NAMESPACE,
      "spTree",
    )[0];
    if (shapeTree) {
      await visitShapeTree(shapeTree, slideContext, importContext);
    }
    if (slideContext.elementCount >= MAX_ELEMENTS_PER_SLIDE) {
      increment(
        importContext.unsupported,
        "slide objects beyond the 1,500 element limit",
      );
    }
    elements.push(...slideContext.elements);
    originX += size.width + SLIDE_GAP;
  }

  return {
    elements,
    files: importContext.files,
    slideCount: slideParts.length,
    unsupported: toRecord(importContext.unsupported),
    flattened: toRecord(importContext.flattened),
  };
};
