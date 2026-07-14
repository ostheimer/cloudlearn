import { describe, it, expect } from "vitest";
import {
  extForMime,
  occlusionImagePath,
  base64ToBytes,
  buildOcclusionCardInputs,
  normalizeDragRect,
  isRegionLargeEnough,
  type OcclusionRegion,
} from "./occlusion";

describe("extForMime", () => {
  it("maps known image mime types to a file extension", () => {
    expect(extForMime("image/png")).toBe("png");
    expect(extForMime("image/jpeg")).toBe("jpg");
    expect(extForMime("image/webp")).toBe("webp");
    expect(extForMime("image/gif")).toBe("gif");
  });

  it("is case-insensitive and falls back to jpg for unknown/missing types", () => {
    expect(extForMime("IMAGE/PNG")).toBe("png");
    expect(extForMime("application/octet-stream")).toBe("jpg");
    expect(extForMime(null)).toBe("jpg");
    expect(extForMime(undefined)).toBe("jpg");
  });
});

describe("occlusionImagePath", () => {
  it("builds a path whose first segment is the user id (bucket RLS requirement)", () => {
    const path = occlusionImagePath("user-1", "deck-9", "abc123", "png");
    expect(path).toBe("user-1/deck-9/abc123.png");
    expect(path.split("/")[0]).toBe("user-1");
  });
});

describe("base64ToBytes", () => {
  it("decodes known vectors identically to Node's Buffer", () => {
    for (const text of ["", "f", "fo", "foo", "foob", "fooba", "foobar", "Hello, clearn!"]) {
      const base64 = Buffer.from(text, "utf8").toString("base64");
      const bytes = base64ToBytes(base64);
      expect(Array.from(bytes)).toEqual(Array.from(Buffer.from(text, "utf8")));
    }
  });

  it("decodes arbitrary binary bytes losslessly", () => {
    const original = new Uint8Array([0, 1, 2, 254, 255, 128, 127, 63, 64, 200, 17]);
    const base64 = Buffer.from(original).toString("base64");
    expect(Array.from(base64ToBytes(base64))).toEqual(Array.from(original));
  });

  it("ignores whitespace inside the base64 string", () => {
    const base64 = Buffer.from("occlusion", "utf8").toString("base64");
    const withWhitespace = base64.slice(0, 4) + "\n  " + base64.slice(4);
    expect(Array.from(base64ToBytes(withWhitespace))).toEqual(
      Array.from(Buffer.from("occlusion", "utf8")),
    );
  });
});

describe("normalizeDragRect", () => {
  it("returns a top-left origin with positive width/height regardless of drag direction", () => {
    for (const r of [normalizeDragRect(0.2, 0.3, 0.6, 0.7), normalizeDragRect(0.6, 0.7, 0.2, 0.3)]) {
      expect(r.x).toBeCloseTo(0.2, 6);
      expect(r.y).toBeCloseTo(0.3, 6);
      expect(r.w).toBeCloseTo(0.4, 6);
      expect(r.h).toBeCloseTo(0.4, 6);
    }
  });

  it("clamps points that leave the image bounds", () => {
    const r = normalizeDragRect(-0.5, 0.5, 1.4, 1.2);
    expect(r.x).toBeCloseTo(0, 6);
    expect(r.y).toBeCloseTo(0.5, 6);
    expect(r.w).toBeCloseTo(1, 6);
    expect(r.h).toBeCloseTo(0.5, 6);
  });
});

describe("isRegionLargeEnough", () => {
  it("rejects a tap or hairline drag but accepts a real box", () => {
    expect(isRegionLargeEnough(0, 0)).toBe(false);
    expect(isRegionLargeEnough(0.02, 0.2)).toBe(false);
    expect(isRegionLargeEnough(0.2, 0.02)).toBe(false);
    expect(isRegionLargeEnough(0.1, 0.1)).toBe(true);
  });
});

describe("buildOcclusionCardInputs", () => {
  const regions: OcclusionRegion[] = [
    { x: 0.1, y: 0.1, w: 0.2, h: 0.2, label: "Blüte" },
    { x: 0.5, y: 0.5, w: 0.2, h: 0.2, label: "  Wurzel  " },
    { x: 0.7, y: 0.2, w: 0.1, h: 0.1, label: "" },
  ];

  it("creates one card per region", () => {
    expect(buildOcclusionCardInputs("user-1/deck-1/img.png", regions)).toHaveLength(3);
  });

  it("hides exactly one region per card via hideIndex, in order", () => {
    const cards = buildOcclusionCardInputs("p.png", regions);
    expect(cards.map((c) => c.extraData.hideIndex)).toEqual([0, 1, 2]);
  });

  it("carries the full cleaned region list on every card", () => {
    const cards = buildOcclusionCardInputs("p.png", regions);
    for (const card of cards) {
      expect(card.extraData.regions.map((r) => r.label)).toEqual([
        "Blüte",
        "Wurzel",
        "Bereich 3",
      ]);
    }
  });

  it("uses the trimmed label as the answer, with a Bereich-N fallback when empty", () => {
    const cards = buildOcclusionCardInputs("p.png", regions);
    expect(cards.map((c) => c.back)).toEqual(["Blüte", "Wurzel", "Bereich 3"]);
  });

  it("stamps each card as an occlusion card pointing at the shared image path", () => {
    const [first] = buildOcclusionCardInputs("user-1/deck-1/img.png", regions);
    expect(first).toMatchObject({
      type: "occlusion",
      difficulty: "medium",
      tags: [],
      sourceImageUrl: "user-1/deck-1/img.png",
      front: "Bild-Occlusion: Was ist an der markierten Stelle?",
    });
  });
});
