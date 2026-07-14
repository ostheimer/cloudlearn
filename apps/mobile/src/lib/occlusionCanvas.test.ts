import { describe, it, expect } from "vitest";
import {
  clampZoom,
  clampPan,
  screenToImageNorm,
  pinchTransform,
  fitViewport,
  MIN_ZOOM,
  MAX_ZOOM,
} from "./occlusionCanvas";

const VP = { vw: 300, vh: 200 };

describe("clampZoom", () => {
  it("keeps zoom within [MIN_ZOOM, MAX_ZOOM]", () => {
    expect(clampZoom(0.2)).toBe(MIN_ZOOM);
    expect(clampZoom(3)).toBe(3);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
  });
});

describe("clampPan", () => {
  it("forces pan to 0 at zoom 1 (image exactly fills the viewport)", () => {
    expect(clampPan({ zoom: 1, panX: -50, panY: 30 }, VP)).toEqual({ zoom: 1, panX: 0, panY: 0 });
  });

  it("keeps the scaled image covering the viewport at zoom > 1", () => {
    // zoom 2 → image is 600x400; panX may range [-300, 0], panY [-200, 0].
    expect(clampPan({ zoom: 2, panX: 100, panY: -500 }, VP)).toEqual({ zoom: 2, panX: 0, panY: -200 });
    expect(clampPan({ zoom: 2, panX: -1000, panY: 50 }, VP)).toEqual({ zoom: 2, panX: -300, panY: 0 });
  });
});

describe("screenToImageNorm", () => {
  it("maps viewport corners to image corners at zoom 1", () => {
    const t = { zoom: 1, panX: 0, panY: 0 };
    expect(screenToImageNorm(0, 0, t, VP)).toEqual({ nx: 0, ny: 0 });
    expect(screenToImageNorm(150, 100, t, VP)).toEqual({ nx: 0.5, ny: 0.5 });
    expect(screenToImageNorm(300, 200, t, VP)).toEqual({ nx: 1, ny: 1 });
  });

  it("accounts for zoom and pan so the box lands where the finger is", () => {
    // Zoomed 2x, panned so the image's right half is shown.
    const t = { zoom: 2, panX: -300, panY: -200 };
    // A tap at the viewport centre (150,100) should hit image point (0.75, 0.75).
    expect(screenToImageNorm(150, 100, t, VP)).toEqual({ nx: 0.75, ny: 0.75 });
  });

  it("clamps a finger that leaves the image to the edge", () => {
    const t = { zoom: 1, panX: 0, panY: 0 };
    expect(screenToImageNorm(-40, 250, t, VP)).toEqual({ nx: 0, ny: 1 });
  });
});

describe("pinchTransform", () => {
  it("keeps the anchored image point under the focal while zooming", () => {
    // Focal at viewport centre; the image point there at start is (0.5,0.5).
    const anchor = screenToImageNorm(150, 100, { zoom: 1, panX: 0, panY: 0 }, VP);
    const t = pinchTransform(1, 2, 150, 100, anchor, VP);
    expect(t.zoom).toBe(2);
    // After zooming, the same focal (150,100) must still map back to (0.5,0.5).
    expect(screenToImageNorm(150, 100, t, VP)).toEqual({ nx: 0.5, ny: 0.5 });
  });

  it("follows the focal as the fingers move", () => {
    const anchor = screenToImageNorm(150, 100, { zoom: 1, panX: 0, panY: 0 }, VP);
    // Same pinch, but the focal has drifted to (120, 80).
    const t = pinchTransform(1, 2, 120, 80, anchor, VP);
    const back = screenToImageNorm(120, 80, t, VP);
    expect(back.nx).toBeCloseTo(0.5, 6);
    expect(back.ny).toBeCloseTo(0.5, 6);
  });

  it("clamps zoom at the maximum", () => {
    const anchor = { nx: 0.5, ny: 0.5 };
    expect(pinchTransform(1, 99, 150, 100, anchor, VP).zoom).toBe(MAX_ZOOM);
  });
});

describe("fitViewport", () => {
  it("fits a wide image to the max width", () => {
    expect(fitViewport(2000, 1000, 300, 400)).toEqual({ vw: 300, vh: 150 });
  });

  it("fits a tall image to the max height", () => {
    // aspect 0.5 → at maxW 300 height would be 600 > maxH 400 → clamp by height.
    expect(fitViewport(500, 1000, 300, 400)).toEqual({ vw: 200, vh: 400 });
  });

  it("falls back to a square for degenerate sizes", () => {
    expect(fitViewport(0, 0, 300, 400)).toEqual({ vw: 300, vh: 300 });
  });
});
