import { describe, expect, it } from "vitest";

import {
  getLocalPreviewTitle,
  normalizeLocalPreviewUrl,
  resizeLivePreview,
  type DrawsyLivePreview,
} from "./LivePreview";

describe("local live preview URLs", () => {
  it.each([
    "http://localhost:5173/",
    "http://127.0.0.1:3000/app",
    "https://[::1]:4173/",
  ])("accepts loopback URL %s", (value) => {
    expect(normalizeLocalPreviewUrl(value)).toBe(value);
  });

  it.each([
    "https://example.com",
    "http://192.168.1.2:3000",
    "file:///tmp/index.html",
    "not a URL",
  ])("rejects non-loopback URL %s", (value) => {
    expect(() => normalizeLocalPreviewUrl(value)).toThrow();
  });

  it("creates a quiet address title", () => {
    expect(getLocalPreviewTitle("http://localhost:5173/dashboard")).toBe(
      "localhost:5173",
    );
  });
});

describe("live preview resizing", () => {
  const preview: DrawsyLivePreview = {
    id: "preview-1",
    canvasId: "canvas-1",
    url: "http://localhost:5173/",
    title: "Local app",
    x: 100,
    y: 200,
    width: 600,
    height: 400,
    collapsed: false,
  };

  it("resizes from every side while preserving the opposite edge", () => {
    expect(resizeLivePreview(preview, "nw", 40, 60, 360, 260)).toEqual({
      x: 140,
      y: 260,
      width: 560,
      height: 340,
    });
    expect(resizeLivePreview(preview, "se", 40, 60, 360, 260)).toEqual({
      x: 100,
      y: 200,
      width: 640,
      height: 460,
    });
  });

  it("clamps size without moving the anchored edge", () => {
    expect(resizeLivePreview(preview, "nw", 500, 500, 360, 260)).toEqual({
      x: 340,
      y: 340,
      width: 360,
      height: 260,
    });
  });
});
