import { describe, expect, it } from "vitest";
import { buildDeckCountLabel } from "./deckCountLabel";

// Muss wortgleich mit apps/web/src/lib/deck-count-label.ts bleiben — dasselbe
// Deck darf in App und Website nicht anders heißen.
describe("buildDeckCountLabel", () => {
  it("names both kinds when a deck holds text and image cards", () => {
    expect(buildDeckCountLabel(20, 10)).toBe("20 Karten · 10 Bild-Karten");
  });

  it("leaves out the part that is zero — '0 Karten · 10 Bild-Karten' reads as empty", () => {
    expect(buildDeckCountLabel(0, 10)).toBe("10 Bild-Karten");
    expect(buildDeckCountLabel(20, 0)).toBe("20 Karten");
  });

  it("returns null for an empty deck, so the empty state isn't duplicated", () => {
    expect(buildDeckCountLabel(0, 0)).toBeNull();
    expect(buildDeckCountLabel(undefined, undefined)).toBeNull();
  });

  it("uses the singular for exactly one", () => {
    expect(buildDeckCountLabel(1, 1)).toBe("1 Karte · 1 Bild-Karte");
  });

  it("treats a missing image count as none — older responses lack the field", () => {
    expect(buildDeckCountLabel(7, undefined)).toBe("7 Karten");
  });
});
