// Zoom/pan canvas math for the occlusion editor (#207 follow-up). Pure and
// unit-tested so the "the box lands exactly where I dragged" guarantee holds
// even while the image is zoomed and panned — the earlier version got this
// wrong because the page scrolled under the finger.
//
// Coordinate model (matches the editor's nested render: a pan view translates,
// an inner view scales from the top-left, the base image is vw x vh):
//   screenX = panX + nx * vw * zoom
//   screenY = panY + ny * vh * zoom
// so the inverse maps a finger point back to a normalized image point (0..1).

export type CanvasViewport = { vw: number; vh: number };
export type CanvasTransform = { zoom: number; panX: number; panY: number };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

// Keep the scaled image covering the viewport — never let a gap open at an edge.
export function clampPan(t: CanvasTransform, vp: CanvasViewport): CanvasTransform {
  const minPanX = vp.vw * (1 - t.zoom);
  const minPanY = vp.vh * (1 - t.zoom);
  return {
    zoom: t.zoom,
    panX: Math.min(0, Math.max(minPanX, t.panX)),
    panY: Math.min(0, Math.max(minPanY, t.panY)),
  };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// Finger point in viewport pixels → normalized image coords (0..1), clamped so
// a drag that leaves the image can't produce an out-of-bounds region.
export function screenToImageNorm(
  sx: number,
  sy: number,
  t: CanvasTransform,
  vp: CanvasViewport,
): { nx: number; ny: number } {
  return {
    nx: clamp01((sx - t.panX) / (vp.vw * t.zoom)),
    ny: clamp01((sy - t.panY) / (vp.vh * t.zoom)),
  };
}

// Pinch-to-zoom anchored on the focal point: the image point that sat under the
// two fingers when the pinch started stays under them as they move and spread.
// `startZoom`/`anchor` are captured at pinch begin; `scaleFactor` is the pinch's
// cumulative scale; `focalX/Y` is the current focal in viewport pixels.
export function pinchTransform(
  startZoom: number,
  scaleFactor: number,
  focalX: number,
  focalY: number,
  anchor: { nx: number; ny: number },
  vp: CanvasViewport,
): CanvasTransform {
  const zoom = clampZoom(startZoom * scaleFactor);
  const panX = focalX - anchor.nx * vp.vw * zoom;
  const panY = focalY - anchor.ny * vp.vh * zoom;
  return clampPan({ zoom, panX, panY }, vp);
}

// Fit an image's aspect ratio into a max box, so the viewport itself matches the
// image aspect (no letterbox → clean coordinate mapping at zoom 1).
export function fitViewport(
  imageWidth: number,
  imageHeight: number,
  maxW: number,
  maxH: number,
): CanvasViewport {
  const aspect = imageWidth > 0 && imageHeight > 0 ? imageWidth / imageHeight : 1;
  let vw = maxW;
  let vh = maxW / aspect;
  if (vh > maxH) {
    vh = maxH;
    vw = maxH * aspect;
  }
  return { vw, vh };
}
