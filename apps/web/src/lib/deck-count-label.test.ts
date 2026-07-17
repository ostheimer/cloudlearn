import { describe, expect, it } from "vitest";
import { deckCountLabel } from "./deck-count-label";

describe("deckCountLabel", () => {
  it("names both kinds when a deck holds text and image cards", () => {
    expect(deckCountLabel(20, 10)).toBe("20 Karten · 10 Bild-Karten");
  });

  it("leaves out the part that is zero — '0 Karten · 10 Bild-Karten' reads as empty", () => {
    expect(deckCountLabel(0, 10)).toBe("10 Bild-Karten");
    expect(deckCountLabel(20, 0)).toBe("20 Karten");
  });

  it("returns null for an empty deck, so the empty state isn't duplicated", () => {
    expect(deckCountLabel(0, 0)).toBeNull();
    expect(deckCountLabel(undefined, undefined)).toBeNull();
  });

  it("uses the singular for exactly one", () => {
    expect(deckCountLabel(1, 1)).toBe("1 Karte · 1 Bild-Karte");
  });

  it("treats a missing image count as none — older responses lack the field", () => {
    expect(deckCountLabel(7, undefined)).toBe("7 Karten");
  });
});
