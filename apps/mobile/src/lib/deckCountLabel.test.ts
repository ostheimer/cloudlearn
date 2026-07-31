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

  describe("Füllstand im Deck-Kopf (#611)", () => {
    it("zeigt den Füllstand, wenn die Grenze bekannt ist", () => {
      expect(buildDeckCountLabel(142, 0, 150)).toBe("142 von 150 Karten");
    });

    it("zählt Bild-Karten in die Summe und weist sie zusätzlich aus", () => {
      expect(buildDeckCountLabel(130, 12, 150)).toBe("142 von 150 Karten · 12 Bild-Karten");
    });

    it("nennt den Leerzustand beim Namen, statt '0 von 150 Karten' zu behaupten (#703)", () => {
      expect(buildDeckCountLabel(0, 0, 150)).toBe("Noch keine Karten");
    });

    it("nennt das volle Deck beim Namen", () => {
      expect(buildDeckCountLabel(150, 0, 150)).toBe("150 von 150 Karten");
    });

    it("bleibt beim alten Label, solange die Grenze unbekannt ist", () => {
      // Der Store liefert `null`, bis der Server die Grenzen mitgeschickt hat
      // (#603) — dann wird nichts behauptet.
      expect(buildDeckCountLabel(20, 10, null)).toBe("20 Karten · 10 Bild-Karten");
      expect(buildDeckCountLabel(20, 10, undefined)).toBe("20 Karten · 10 Bild-Karten");
    });

    it("zeigt Decks über der Grenze ehrlich an, statt zu schummeln", () => {
      expect(buildDeckCountLabel(762, 0, 150)).toBe("762 von 150 Karten");
    });
  });
});
