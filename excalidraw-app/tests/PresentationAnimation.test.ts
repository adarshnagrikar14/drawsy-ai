import {
  createPresentationAnimationMetadata,
  getPresentationTargetFrameId,
  getHiddenPresentationBuildTargetIds,
  getPresentationBuildSequence,
  getPreviousPresentationBuildCount,
  sanitizePresentationAnimationMetadata,
} from "../presentation/animations";

const frame = {
  id: "frame-1",
  type: "frame",
  x: 0,
  y: 0,
  width: 800,
  height: 450,
  angle: 0,
  strokeColor: "#1e1e1e",
  backgroundColor: "transparent",
  fillStyle: "solid",
  strokeWidth: 2,
  strokeStyle: "solid",
  roughness: 0,
  opacity: 100,
  groupIds: [],
  frameId: null,
  index: "a0",
  roundness: null,
  seed: 1,
  version: 1,
  versionNonce: 1,
  isDeleted: false,
  boundElements: [],
  updated: 1,
  link: null,
  locked: false,
};

const rectangle = (id: string, frameId = "frame-1") => ({
  ...frame,
  id,
  type: "rectangle",
  frameId,
});

describe("presentation animation metadata", () => {
  it("keeps a same-slide multi-object build and removes invalid targets", () => {
    const metadata = {
      ...createPresentationAnimationMetadata(),
      builds: [
        {
          id: "build-1",
          frameId: "frame-1",
          targetIds: ["one", "two", "outside"],
          effect: "fade" as const,
          trigger: "with-previous" as const,
          direction: "left" as const,
        },
      ],
    };

    const sanitized = sanitizePresentationAnimationMetadata(metadata, [
      frame,
      rectangle("one"),
      rectangle("two"),
      rectangle("outside", "other-frame"),
    ] as any);

    expect(sanitized.builds).toEqual([
      {
        ...metadata.builds[0],
        targetIds: ["one", "two"],
        trigger: "on-click",
      },
    ]);
  });

  it("uses Excalidraw frame containment for manually framed objects", () => {
    const manuallyFramed = {
      ...rectangle("manual"),
      frameId: null,
      x: 120,
      y: 120,
      width: 240,
      height: 120,
    };

    expect(
      getPresentationTargetFrameId(
        manuallyFramed as any,
        [frame, manuallyFramed] as any,
      ),
    ).toBe("frame-1");

    const sanitized = sanitizePresentationAnimationMetadata(
      {
        ...createPresentationAnimationMetadata(),
        builds: [
          {
            id: "manual-build",
            frameId: "frame-1",
            targetIds: ["manual"],
            effect: "fade",
            trigger: "on-click",
            direction: "left",
          },
        ],
      },
      [frame, manuallyFramed] as any,
    );

    expect(sanitized.builds).toHaveLength(1);
  });

  it("plays with and after-previous builds as one click sequence", () => {
    const builds = [
      {
        id: "one",
        frameId: "frame-1",
        targetIds: ["one"],
        effect: "fade" as const,
        trigger: "on-click" as const,
        direction: "left" as const,
      },
      {
        id: "two",
        frameId: "frame-1",
        targetIds: ["two"],
        effect: "appear" as const,
        trigger: "with-previous" as const,
        direction: "left" as const,
      },
      {
        id: "three",
        frameId: "frame-1",
        targetIds: ["three"],
        effect: "fly" as const,
        trigger: "after-previous" as const,
        direction: "up" as const,
      },
    ];

    expect(getPresentationBuildSequence(builds, 0)).toMatchObject({
      stages: [[builds[0], builds[1]], [builds[2]]],
      completedBuildCount: 3,
    });
    expect(getPreviousPresentationBuildCount(builds, 3)).toBe(0);
  });

  it("hides only future builds when entering a slide", () => {
    const metadata = {
      ...createPresentationAnimationMetadata(),
      builds: [
        {
          id: "one",
          frameId: "frame-1",
          targetIds: ["one", "two"],
          effect: "fade" as const,
          trigger: "on-click" as const,
          direction: "left" as const,
        },
        {
          id: "two",
          frameId: "frame-1",
          targetIds: ["three"],
          effect: "appear" as const,
          trigger: "on-click" as const,
          direction: "left" as const,
        },
      ],
    };

    expect([
      ...getHiddenPresentationBuildTargetIds(metadata, "frame-1", 1),
    ]).toEqual(["three"]);
  });
});
