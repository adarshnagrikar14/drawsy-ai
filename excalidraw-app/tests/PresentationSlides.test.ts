import { getPresentationSlideDescriptors } from "../presentation/slides";

const baseElement = {
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

const frame = (id: string, x: number, index: string) => ({
  ...baseElement,
  id,
  type: "frame",
  x,
  index,
  name: id,
});

const rectangle = (
  id: string,
  x: number,
  frameId: string | null,
  index: string,
) => ({
  ...baseElement,
  id,
  type: "rectangle",
  x,
  y: 100,
  width: 120,
  height: 80,
  frameId,
  index,
});

describe("presentation slide descriptors", () => {
  it("isolates each slide and changes only the edited slide revision", () => {
    const firstFrame = frame("frame-1", 0, "a0");
    const firstChild = rectangle("child-1", 100, "frame-1", "a1");
    const manuallyFramed = rectangle("manual", 300, null, "a2");
    const secondFrame = frame("frame-2", 1000, "a3");
    const secondChild = rectangle("child-2", 1100, "frame-2", "a4");
    const elements = [
      firstFrame,
      firstChild,
      manuallyFramed,
      secondFrame,
      secondChild,
    ] as any;

    const initial = getPresentationSlideDescriptors(elements);

    expect(initial.map((slide) => slide.frame.id)).toEqual([
      "frame-1",
      "frame-2",
    ]);
    expect(initial[0].elements.map((element) => element.id)).toEqual([
      "frame-1",
      "child-1",
      "manual",
    ]);
    expect(initial[1].elements.map((element) => element.id)).toEqual([
      "frame-2",
      "child-2",
    ]);
    expect(initial.map((slide) => slide.childCount)).toEqual([1, 1]);

    const edited = getPresentationSlideDescriptors([
      firstFrame,
      { ...firstChild, version: 2, versionNonce: 2 },
      manuallyFramed,
      secondFrame,
      secondChild,
    ] as any);

    expect(edited[0].revision).not.toBe(initial[0].revision);
    expect(edited[1].revision).toBe(initial[1].revision);
  });
});
