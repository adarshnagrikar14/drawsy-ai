import {
  filterElementsEligibleAsFrameChildren,
  getNonDeletedElements,
  hashElementsVersion,
  isFrameLikeElement,
  isInitializedImageElement,
} from "@excalidraw/element";

import type {
  ExcalidrawFrameLikeElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";

export type PresentationSlideDescriptor = {
  frame: ExcalidrawFrameLikeElement;
  elements: readonly OrderedExcalidrawElement[];
  childCount: number;
  fileIds: readonly string[];
  revision: string;
};

const sortFramesForSlides = (frames: readonly ExcalidrawFrameLikeElement[]) =>
  [...frames].sort((a, b) => {
    const rowTolerance = Math.max(80, Math.min(a.height, b.height) * 0.2);
    if (Math.abs(a.y - b.y) > rowTolerance) {
      return a.y - b.y;
    }
    return a.x - b.x;
  });

export const getPresentationSlideDescriptors = (
  elements: readonly OrderedExcalidrawElement[],
): PresentationSlideDescriptor[] => {
  const nonDeletedElements = getNonDeletedElements(elements);
  const frames = sortFramesForSlides(
    nonDeletedElements.filter(
      isFrameLikeElement,
    ) as ExcalidrawFrameLikeElement[],
  );
  const frameIds = new Set(frames.map((frame) => frame.id));
  const childrenByFrameId = new Map<string, OrderedExcalidrawElement[]>(
    frames.map((frame) => [frame.id, []]),
  );
  const unframedElements: OrderedExcalidrawElement[] = [];
  const orderByElementId = new Map(
    nonDeletedElements.map((element, index) => [element.id, index]),
  );

  for (const element of nonDeletedElements) {
    if (isFrameLikeElement(element)) {
      continue;
    }

    if (element.frameId && frameIds.has(element.frameId)) {
      childrenByFrameId.get(element.frameId)!.push(element);
    } else if (!element.frameId) {
      unframedElements.push(element);
    }
  }

  // Existing drawings framed after creation can temporarily remain unassigned.
  // Keep those visually contained elements in the preview without rescanning the
  // entire deck for every frame.
  const overlapCandidates = [
    ...frames,
    ...unframedElements,
  ] as readonly OrderedExcalidrawElement[];

  return frames.map((frame) => {
    const directChildren = childrenByFrameId.get(frame.id) || [];
    const eligibleUnframed = filterElementsEligibleAsFrameChildren(
      overlapCandidates,
      frame,
    ) as OrderedExcalidrawElement[];
    const renderElementById = new Map(
      [frame, ...directChildren, ...eligibleUnframed].map((element) => [
        element.id,
        element,
      ]),
    );
    const renderElements = [...renderElementById.values()].sort(
      (first, second) =>
        (orderByElementId.get(first.id) || 0) -
        (orderByElementId.get(second.id) || 0),
    ) as OrderedExcalidrawElement[];
    const fileIds = renderElements.flatMap((element) =>
      isInitializedImageElement(element) ? [element.fileId] : [],
    );

    return {
      frame,
      elements: renderElements,
      childCount: directChildren.length,
      fileIds,
      revision: `${renderElements.length}:${hashElementsVersion(
        renderElements,
      )}`,
    };
  });
};
