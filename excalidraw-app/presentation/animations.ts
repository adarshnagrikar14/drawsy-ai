import {
  filterElementsEligibleAsFrameChildren,
  getNonDeletedElements,
  isFrameLikeElement,
} from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

export type PresentationBuildEffect = "appear" | "fade" | "fly";
export type PresentationBuildDirection = "left" | "right" | "up" | "down";
export type PresentationBuildTrigger =
  | "on-click"
  | "with-previous"
  | "after-previous";

export type PresentationBuild = {
  id: string;
  frameId: string;
  targetIds: string[];
  effect: PresentationBuildEffect;
  trigger: PresentationBuildTrigger;
  direction: PresentationBuildDirection;
};

export type PresentationSlideTransition = "none" | "fade";

export type PresentationAnimationMetadata = {
  version: 1;
  builds: PresentationBuild[];
  transitions: Record<string, PresentationSlideTransition>;
};

export type PresentationBuildSequence = {
  stages: PresentationBuild[][];
  completedBuildCount: number;
};

const BUILD_EFFECTS = new Set<PresentationBuildEffect>([
  "appear",
  "fade",
  "fly",
]);
const BUILD_DIRECTIONS = new Set<PresentationBuildDirection>([
  "left",
  "right",
  "up",
  "down",
]);
const BUILD_TRIGGERS = new Set<PresentationBuildTrigger>([
  "on-click",
  "with-previous",
  "after-previous",
]);
const SLIDE_TRANSITIONS = new Set<PresentationSlideTransition>([
  "none",
  "fade",
]);

export const createPresentationAnimationMetadata =
  (): PresentationAnimationMetadata => ({
    version: 1,
    builds: [],
    transitions: {},
  });

export const getPresentationTargetFrameId = (
  target: ExcalidrawElement,
  elements: readonly ExcalidrawElement[],
) => {
  const nonDeletedElements = getNonDeletedElements(elements);
  const frames = nonDeletedElements.filter(isFrameLikeElement);

  if (target.isDeleted || isFrameLikeElement(target)) {
    return null;
  }

  if (target.frameId) {
    return frames.some((frame) => frame.id === target.frameId)
      ? target.frameId
      : null;
  }

  const containingFrames = frames.filter((frame) =>
    filterElementsEligibleAsFrameChildren(nonDeletedElements, frame).some(
      (element) => element.id === target.id,
    ),
  );

  return containingFrames.length === 1 ? containingFrames[0].id : null;
};

const normalizeBuildStartTriggers = (builds: PresentationBuild[]) => {
  const frameIdsWithBuilds = new Set<string>();

  return builds.map((build) => {
    const trigger = frameIdsWithBuilds.has(build.frameId)
      ? build.trigger
      : "on-click";
    frameIdsWithBuilds.add(build.frameId);
    return trigger === build.trigger ? build : { ...build, trigger };
  });
};

const isBuildEffect = (value: unknown): value is PresentationBuildEffect =>
  typeof value === "string" &&
  BUILD_EFFECTS.has(value as PresentationBuildEffect);

const isBuildDirection = (
  value: unknown,
): value is PresentationBuildDirection =>
  typeof value === "string" &&
  BUILD_DIRECTIONS.has(value as PresentationBuildDirection);

const isBuildTrigger = (value: unknown): value is PresentationBuildTrigger =>
  typeof value === "string" &&
  BUILD_TRIGGERS.has(value as PresentationBuildTrigger);

const isSlideTransition = (
  value: unknown,
): value is PresentationSlideTransition =>
  typeof value === "string" &&
  SLIDE_TRANSITIONS.has(value as PresentationSlideTransition);

const normalizeBuild = (value: unknown): PresentationBuild | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const build = value as Partial<PresentationBuild>;
  if (
    typeof build.id !== "string" ||
    typeof build.frameId !== "string" ||
    !Array.isArray(build.targetIds) ||
    !isBuildEffect(build.effect)
  ) {
    return null;
  }

  const targetIds = [
    ...new Set(build.targetIds.filter((id) => typeof id === "string")),
  ];
  if (!targetIds.length) {
    return null;
  }

  return {
    id: build.id,
    frameId: build.frameId,
    targetIds,
    effect: build.effect,
    trigger: isBuildTrigger(build.trigger) ? build.trigger : "on-click",
    direction: isBuildDirection(build.direction) ? build.direction : "left",
  };
};

export const normalizePresentationAnimationMetadata = (
  value: unknown,
): PresentationAnimationMetadata => {
  if (!value || typeof value !== "object") {
    return createPresentationAnimationMetadata();
  }

  const metadata = value as Partial<PresentationAnimationMetadata>;
  const builds = Array.isArray(metadata.builds)
    ? metadata.builds
        .map(normalizeBuild)
        .filter((build): build is PresentationBuild => !!build)
    : [];
  const transitions = Object.fromEntries(
    Object.entries(metadata.transitions || {}).filter(
      ([frameId, transition]) =>
        typeof frameId === "string" && isSlideTransition(transition),
    ),
  ) as Record<string, PresentationSlideTransition>;

  return {
    version: 1,
    builds: normalizeBuildStartTriggers(builds),
    transitions,
  };
};

export const sanitizePresentationAnimationMetadata = (
  metadata: PresentationAnimationMetadata,
  elements: readonly ExcalidrawElement[],
): PresentationAnimationMetadata => {
  const nonDeletedElements = getNonDeletedElements(elements);
  const elementById = new Map(
    nonDeletedElements.map((element) => [element.id, element]),
  );
  const frameIds = new Set(
    nonDeletedElements.filter(isFrameLikeElement).map((frame) => frame.id),
  );

  const builds = metadata.builds.flatMap((build) => {
    if (!frameIds.has(build.frameId)) {
      return [];
    }

    const targetIds = build.targetIds.filter((targetId) => {
      const target = elementById.get(targetId);
      return (
        !!target &&
        getPresentationTargetFrameId(target, nonDeletedElements) ===
          build.frameId
      );
    });

    return targetIds.length ? [{ ...build, targetIds }] : [];
  });

  const transitions = Object.fromEntries(
    Object.entries(metadata.transitions).filter(([frameId]) =>
      frameIds.has(frameId),
    ),
  ) as Record<string, PresentationSlideTransition>;

  return {
    version: 1,
    builds: normalizeBuildStartTriggers(builds),
    transitions,
  };
};

export const arePresentationAnimationMetadataEqual = (
  first: PresentationAnimationMetadata,
  second: PresentationAnimationMetadata,
) =>
  first === second ||
  (first.builds.length === second.builds.length &&
    Object.keys(first.transitions).length ===
      Object.keys(second.transitions).length &&
    first.builds.every((build, index) => {
      const otherBuild = second.builds[index];
      return (
        build.id === otherBuild?.id &&
        build.frameId === otherBuild.frameId &&
        build.effect === otherBuild.effect &&
        build.trigger === otherBuild.trigger &&
        build.direction === otherBuild.direction &&
        build.targetIds.length === otherBuild.targetIds.length &&
        build.targetIds.every(
          (targetId, targetIndex) =>
            targetId === otherBuild.targetIds[targetIndex],
        )
      );
    }) &&
    Object.entries(first.transitions).every(
      ([frameId, transition]) => second.transitions[frameId] === transition,
    ));

export const getPresentationBuilds = (
  metadata: PresentationAnimationMetadata,
  frameId: string,
) => metadata.builds.filter((build) => build.frameId === frameId);

export const getPresentationBuildSequence = (
  builds: readonly PresentationBuild[],
  completedBuildCount: number,
): PresentationBuildSequence | null => {
  const firstBuild = builds[completedBuildCount];
  if (!firstBuild) {
    return null;
  }

  const stages: PresentationBuild[][] = [[firstBuild]];
  let completed = completedBuildCount + 1;

  while (completed < builds.length) {
    const nextBuild = builds[completed];
    if (nextBuild.trigger === "on-click") {
      break;
    }

    if (nextBuild.trigger === "with-previous") {
      stages.at(-1)?.push(nextBuild);
    } else {
      stages.push([nextBuild]);
    }
    completed += 1;
  }

  return { stages, completedBuildCount: completed };
};

export const getPreviousPresentationBuildCount = (
  builds: readonly PresentationBuild[],
  completedBuildCount: number,
) => {
  if (completedBuildCount <= 0) {
    return 0;
  }

  let completed = 0;
  let previousCompleted = 0;
  while (completed < builds.length) {
    const sequence = getPresentationBuildSequence(builds, completed);
    if (!sequence || sequence.completedBuildCount >= completedBuildCount) {
      return previousCompleted;
    }
    previousCompleted = sequence.completedBuildCount;
    completed = sequence.completedBuildCount;
  }

  return previousCompleted;
};

export const getHiddenPresentationBuildTargetIds = (
  metadata: PresentationAnimationMetadata,
  frameId: string,
  completedBuildCount: number,
) =>
  new Set(
    getPresentationBuilds(metadata, frameId)
      .slice(completedBuildCount)
      .flatMap((build) => build.targetIds),
  );
