import { describe, expect, it } from "vitest";
import { groupOcclusionImages } from "./occlusion-groups";

const regions = [{ x: .1, y: .2, w: .2, h: .2, label: "Old label" }, { x: .6, y: .3, w: .2, h: .2, label: "Second" }];
const cards = [
  { id: "a", type: "occlusion", sourceImageUrl: "user/a.png", back: "Edited answer", extraData: { regions, hideIndex: 0, custom: "preserve" } },
  { id: "b", type: "occlusion", sourceImageUrl: "user/a.png", back: "Second", extraData: { regions, hideIndex: 1 } },
  { id: "sibling", type: "occlusion", sourceImageUrl: "user/a.png", back: "Second", extraData: { regions, hideIndex: 1 } },
  { id: "other", type: "occlusion", sourceImageUrl: "user/b.png", back: "Other", extraData: { regions, hideIndex: 0 } },
  { id: "ordinary", type: "basic", sourceImageUrl: "user/a.png", back: "Other" },
];
describe("existing occlusion images (#731)", () => {
  it("groups exact image paths, preserves siblings and uses the current card answer", () => {
    const groups = groupOcclusionImages(cards);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.cards.map(c => c.id)).toEqual(["a", "b", "sibling"]);
    expect(groups[0]?.regions).toEqual([{ ...regions[0], label: "Edited answer", cardIds: ["a"] }, { ...regions[1], cardIds: ["b", "sibling"] }]);
  });
  it("does not recreate a region whose card has already been removed", () => {
    expect(groupOcclusionImages(cards.filter(c => c.id !== "a"))[0]?.regions).toHaveLength(1);
  });
  it("blocks malformed images rather than silently omitting an uneditable sibling", () => {
    const bad = { ...cards[0]!, id: "bad", extraData: { regions, hideIndex: 200 } };
    expect(groupOcclusionImages([...cards, bad])[0]?.editable).toBe(false);
  });
});
