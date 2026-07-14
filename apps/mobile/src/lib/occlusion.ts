// Image Occlusion — pure helpers (#207). No React Native / Supabase imports so
// this stays unit-testable in the node vitest environment. The device-only
// storage upload lives in ./occlusionStorage.
//
// Cards produced here are byte-for-byte compatible with the web editor
// (apps/web/app/dashboard/deck/[id]/occlusion/new/page.tsx): one card per
// masked region, image stored as a private path in the "card-images" bucket,
// regions + hideIndex carried in extraData — so a card made on the phone can be
// learned on the web and vice versa.

export const CARD_IMAGE_BUCKET = "card-images";

export type OcclusionRegion = {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
};

// Input shape accepted by api.createCard for an occlusion card.
export type OcclusionCardInput = {
  front: string;
  back: string;
  type: "occlusion";
  difficulty: "medium";
  tags: string[];
  sourceImageUrl: string;
  extraData: { regions: OcclusionRegion[]; hideIndex: number };
};

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Storage file extension for a picked image. Falls back to jpg — the same
// default the web editor uses when the MIME type is unknown.
export function extForMime(mime: string | null | undefined): string {
  if (!mime) return "jpg";
  return EXT_BY_MIME[mime.toLowerCase()] ?? "jpg";
}

// Storage path for a card image. The first path segment MUST be the user id —
// the bucket's RLS policies (migration 20260713091652) only let a user read and
// write files under their own uid folder.
export function occlusionImagePath(
  userId: string,
  deckId: string,
  uniqueId: string,
  ext: string,
): string {
  return `${userId}/${deckId}/${uniqueId}.${ext}`;
}

// Decode a base64 string (as returned by expo-image-picker's `base64` field)
// into raw bytes for Supabase Storage upload. Hermes has no Buffer/atob, so we
// decode by hand. Whitespace and padding are ignored.
const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const outLength = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(outLength);
  let p = 0;

  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64_ALPHABET.indexOf(clean[i] ?? "");
    const c1 = B64_ALPHABET.indexOf(clean[i + 1] ?? "");
    const c2 = i + 2 < clean.length ? B64_ALPHABET.indexOf(clean[i + 2] ?? "") : -1;
    const c3 = i + 3 < clean.length ? B64_ALPHABET.indexOf(clean[i + 3] ?? "") : -1;

    const chunk = (c0 << 18) | (c1 << 12) | ((c2 & 63) << 6) | (c3 & 63);

    if (p < outLength) bytes[p++] = (chunk >> 16) & 0xff;
    if (c2 !== -1 && p < outLength) bytes[p++] = (chunk >> 8) & 0xff;
    if (c3 !== -1 && p < outLength) bytes[p++] = chunk & 0xff;
  }

  return bytes;
}

// Smallest box (as a fraction of the image) that counts as a real region — a
// tap or tiny drag is ignored. Same threshold the web editor uses.
export const MIN_REGION_SIZE = 0.04;

// A parsed occlusion card, ready for the study screen.
export type OcclusionStudyItem = {
  id: string;
  path: string;
  regions: OcclusionRegion[];
  hideIndex: number;
  label: string;
};

function isValidRegion(value: unknown): value is OcclusionRegion {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.x === "number" &&
    typeof r.y === "number" &&
    typeof r.w === "number" &&
    typeof r.h === "number"
  );
}

// Turn a card into an occlusion study task, or null when it is not a usable
// occlusion card (normal card, missing image, malformed regions, hideIndex out
// of range). Mirrors the web study parser (apps/web/.../occlusion/page.tsx) so
// cards created on either platform learn identically. The editable card back
// wins over the frozen extraData label as the answer.
export function parseOcclusionCard(card: {
  id: string;
  type: string;
  back: string;
  sourceImageUrl?: string;
  extraData?: Record<string, unknown>;
}): OcclusionStudyItem | null {
  if (card.type !== "occlusion" || !card.sourceImageUrl) return null;

  const raw = card.extraData?.regions;
  const regions = Array.isArray(raw) && raw.every(isValidRegion) ? (raw as OcclusionRegion[]) : null;
  const hideIndex = typeof card.extraData?.hideIndex === "number" ? card.extraData.hideIndex : 0;
  const target = regions?.[hideIndex];
  if (!regions || regions.length === 0 || !target) return null;

  const label = (card.back || target.label || "").trim() || "?";
  return { id: card.id, path: card.sourceImageUrl, regions, hideIndex, label };
}

// Turn a drag (start + current point, each in 0-1 image fractions) into a
// normalized rectangle: top-left origin, positive width/height, clamped to the
// image. Pure so the drawing math is unit-tested without a device.
export function normalizeDragRect(
  sx: number,
  sy: number,
  x: number,
  y: number,
): { x: number; y: number; w: number; h: number } {
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const cx0 = clamp(sx);
  const cy0 = clamp(sy);
  const cx1 = clamp(x);
  const cy1 = clamp(y);
  return {
    x: Math.min(cx0, cx1),
    y: Math.min(cy0, cy1),
    w: Math.abs(cx1 - cx0),
    h: Math.abs(cy1 - cy0),
  };
}

export function isRegionLargeEnough(w: number, h: number): boolean {
  return w > MIN_REGION_SIZE && h > MIN_REGION_SIZE;
}

// Turn a picked image + drawn regions into one occlusion card per region. Each
// card hides exactly its own region (hideIndex) but carries the full region
// list, so the study screen can also mask the *other* regions when the learner
// chooses the harder mode. Mirrors the web editor's save() exactly.
export function buildOcclusionCardInputs(
  imagePath: string,
  regions: OcclusionRegion[],
): OcclusionCardInput[] {
  const clean: OcclusionRegion[] = regions.map((r, i) => ({
    ...r,
    label: r.label.trim() || `Bereich ${i + 1}`,
  }));

  return clean.map((region, i) => ({
    front: "Bild-Occlusion: Was ist an der markierten Stelle?",
    back: region.label,
    type: "occlusion",
    difficulty: "medium",
    tags: [],
    sourceImageUrl: imagePath,
    extraData: { regions: clean, hideIndex: i },
  }));
}
