import { describe, it, expect } from "vitest";
import {
  extForMime,
  occlusionImagePath,
  base64ToBytes,
  buildOcclusionCardInputs,
  normalizeDragRect,
  isRegionLargeEnough,
  parseOcclusionCard,
  groupOcclusionCards,
  isOcclusionCard,
  excludeOcclusionCards,
  type OcclusionRegion,
  type OcclusionStudyItem,
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

describe("parseOcclusionCard", () => {
  const validCard = {
    id: "c1",
    type: "occlusion",
    back: "Blüte",
    sourceImageUrl: "user-1/deck-1/img.png",
    extraData: {
      regions: [
        { x: 0.1, y: 0.1, w: 0.2, h: 0.2, label: "Blüte" },
        { x: 0.5, y: 0.5, w: 0.2, h: 0.2, label: "Wurzel" },
      ],
      hideIndex: 1,
    },
  };

  it("parses a well-formed occlusion card into a study item", () => {
    const item = parseOcclusionCard(validCard);
    expect(item).toMatchObject({
      id: "c1",
      path: "user-1/deck-1/img.png",
      hideIndex: 1,
      label: "Blüte",
    });
    expect(item?.regions).toHaveLength(2);
  });

  it("prefers the editable card back over the frozen region label as the answer", () => {
    const item = parseOcclusionCard({ ...validCard, back: "Angepasst" });
    expect(item?.label).toBe("Angepasst");
  });

  it("falls back to the region label, then '?', when the back is empty", () => {
    const fromRegion = parseOcclusionCard({ ...validCard, back: "" });
    expect(fromRegion?.label).toBe("Wurzel");
    const unlabeled = {
      ...validCard,
      back: "",
      extraData: { regions: [{ x: 0, y: 0, w: 0.2, h: 0.2, label: "" }], hideIndex: 0 },
    };
    expect(parseOcclusionCard(unlabeled)?.label).toBe("?");
  });

  it("rejects non-occlusion cards and cards without an image", () => {
    expect(parseOcclusionCard({ ...validCard, type: "basic" })).toBeNull();
    expect(parseOcclusionCard({ id: "c", type: "occlusion", back: "x" })).toBeNull();
  });

  it("rejects malformed or out-of-range regions", () => {
    expect(
      parseOcclusionCard({ ...validCard, extraData: { regions: [], hideIndex: 0 } }),
    ).toBeNull();
    expect(
      parseOcclusionCard({ ...validCard, extraData: { regions: [{ x: 0.1 }], hideIndex: 0 } }),
    ).toBeNull();
    expect(
      parseOcclusionCard({ ...validCard, extraData: { regions: validCard.extraData.regions, hideIndex: 5 } }),
    ).toBeNull();
  });

  it("defaults hideIndex to 0 when missing", () => {
    const item = parseOcclusionCard({
      ...validCard,
      back: "",
      extraData: { regions: validCard.extraData.regions },
    });
    expect(item?.hideIndex).toBe(0);
    expect(item?.label).toBe("Blüte");
  });
});

describe("isOcclusionCard / excludeOcclusionCards", () => {
  const basic = { id: "b1", type: "basic", front: "le chien", back: "der Hund" };
  const occ = { id: "o1", type: "occlusion", front: "Bild-Occlusion: Was ist an der markierten Stelle?", back: "Bereich 7" };

  it("recognises occlusion cards by type", () => {
    expect(isOcclusionCard(occ)).toBe(true);
    expect(isOcclusionCard(basic)).toBe(false);
    // A card without a type (older rows default to "basic" server-side) is kept.
    expect(isOcclusionCard({})).toBe(false);
  });

  it("keeps every normal card and drops the occlusion ones", () => {
    const kept = excludeOcclusionCards([basic, occ, { ...basic, id: "b2" }]);
    expect(kept.map((c) => c.id)).toEqual(["b1", "b2"]);
  });

  it("leaves a deck without occlusion cards untouched, and empties an all-occlusion one", () => {
    expect(excludeOcclusionCards([basic]).map((c) => c.id)).toEqual(["b1"]);
    expect(excludeOcclusionCards([occ, { ...occ, id: "o2" }])).toEqual([]);
    expect(excludeOcclusionCards([])).toEqual([]);
  });
});

describe("groupOcclusionCards", () => {
  const item = (id: string, path: string, hideIndex: number): OcclusionStudyItem => ({
    id,
    path,
    regions: [
      { x: 0.1, y: 0.1, w: 0.2, h: 0.2, label: "A" },
      { x: 0.5, y: 0.5, w: 0.2, h: 0.2, label: "B" },
    ],
    hideIndex,
    label: hideIndex === 0 ? "A" : "B",
  });

  it("groups cards of the same image and collects their ids", () => {
    const groups = groupOcclusionCards([
      item("c1", "user/deck/img1.jpg", 0),
      item("c2", "user/deck/img1.jpg", 1),
      item("c3", "user/deck/img2.jpg", 0),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ path: "user/deck/img1.jpg", cardIds: ["c1", "c2"] });
    expect(groups[0]?.regions).toHaveLength(2);
    expect(groups[1]).toMatchObject({ path: "user/deck/img2.jpg", cardIds: ["c3"] });
  });

  it("keeps first-seen order and returns an empty list for no cards", () => {
    expect(groupOcclusionCards([])).toEqual([]);
    const groups = groupOcclusionCards([item("c1", "b.jpg", 0), item("c2", "a.jpg", 0)]);
    expect(groups.map((g) => g.path)).toEqual(["b.jpg", "a.jpg"]);
  });
});
