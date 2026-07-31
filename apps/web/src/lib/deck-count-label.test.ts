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

  describe("Füllstand im Deck-Kopf (#611)", () => {
    it("zeigt den Füllstand, wenn die Grenze bekannt ist", () => {
      expect(deckCountLabel(142, 0, 150)).toBe("142 von 150 Karten");
    });

    it("zählt Bild-Karten in die Summe und weist sie zusätzlich aus", () => {
      // Der Server zählt beim Durchsetzen der Grenze jede lebende Karte. Stünde
      // links nur die Textzahl, wäre der Füllstand eine Lüge.
      expect(deckCountLabel(130, 12, 150)).toBe("142 von 150 Karten · 12 Bild-Karten");
    });

    it("nennt den Leerzustand beim Namen, statt '0 von 150 Karten' zu behaupten (#703)", () => {
      // „0 von 150 Karten" liest sich wie eine Auskunft übers Deck, ist aber
      // nur eine leere Formel — der Leerzustand-Satz sagt es besser.
      expect(deckCountLabel(0, 0, 150)).toBe("Noch keine Karten");
    });

    it("nennt das volle Deck beim Namen", () => {
      expect(deckCountLabel(150, 0, 150)).toBe("150 von 150 Karten");
    });

    it("bleibt beim alten Label, solange die Grenze unbekannt ist", () => {
      // Älterer Server ohne `usage.limits` (#603): nichts behaupten.
      expect(deckCountLabel(20, 10, undefined)).toBe("20 Karten · 10 Bild-Karten");
      expect(deckCountLabel(20, 10, null)).toBe("20 Karten · 10 Bild-Karten");
    });

    it("zeigt Decks über der Grenze ehrlich an, statt zu schummeln", () => {
      // Gibt es in Produktion (Pro-Zeit, Direkt-Eintraege). Ihre Karten bleiben,
      // nur neue kommen nicht dazu — dann steht hier eben 762 von 150.
      expect(deckCountLabel(762, 0, 150)).toBe("762 von 150 Karten");
    });
  });
});
