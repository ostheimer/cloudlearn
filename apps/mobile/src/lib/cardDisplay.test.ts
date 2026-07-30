import { describe, expect, it } from "vitest";
import {
  cardDeleteQuestion,
  cardKindLabel,
  cardSideTexts,
  matchTileTexts,
} from "./cardDisplay";

describe("cardSideTexts (#592)", () => {
  it("lässt gewöhnliche Textkarten unverändert", () => {
    const sides = cardSideTexts({ front: "la courbe", back: "die Kurve" });
    expect(sides.front).toBe("la courbe");
    expect(sides.back).toBe("die Kurve");
  });

  it("entfernt Bild-Markdown und Übersetzungs-Zusätze", () => {
    const sides = cardSideTexts({
      front: "![Foto](https://example.com/a.png) Was heißt 'le soleil' auf Deutsch?",
      back: "die Sonne",
    });
    expect(sides.front).toBe("le soleil");
    expect(sides.back).toBe("die Sonne");
  });

  it("eine reine Bild-Seite fällt auf ihre Beschriftung zurück", () => {
    const sides = cardSideTexts({
      front: "![Zellkern](https://example.com/zelle.png)",
      back: "Nucleus",
    });
    expect(sides.front).toBe("Zellkern");
    expect(sides.media.frontImages).toHaveLength(1);
  });

  it("ohne Beschriftung bleibt die Bild-Seite leer — nie roher Markdown-Code", () => {
    const sides = cardSideTexts({
      front: "![](https://example.com/x.png)",
      back: "Nucleus",
    });
    expect(sides.front).toBe("");
    expect(sides.media.frontImages).toHaveLength(1);
  });

  it("die {{cN::…}}-Lücke bleibt im Text stehen (Strich machen die Aufrufer)", () => {
    const sides = cardSideTexts({
      front: "Berlin liegt an der {{c1::Spree}}.",
      back: "Spree",
    });
    expect(sides.front).toBe("Berlin liegt an der {{c1::Spree}}.");
  });
});

describe("matchTileTexts (#592)", () => {
  it("lässt gewöhnliche Textkarten unverändert", () => {
    expect(matchTileTexts({ front: "la courbe", back: "die Kurve" })).toEqual({
      front: "la courbe",
      back: "die Kurve",
    });
  });

  it("zeigt beim Lückensatz den Strich statt des Lücken-Codes", () => {
    const tiles = matchTileTexts({
      front: "Die Hauptstadt von Frankreich ist {{c1::Paris}}.",
      back: "Paris",
    });
    expect(tiles?.front).toBe("Die Hauptstadt von Frankreich ist ______.");
    expect(tiles?.back).toBe("Paris");
  });

  it("eine reine Bild-Seite fällt auf ihre Beschriftung zurück", () => {
    const tiles = matchTileTexts({
      front: "![Zellkern](https://example.com/zelle.png)",
      back: "Nucleus",
    });
    expect(tiles?.front).toBe("Zellkern");
    expect(tiles?.back).toBe("Nucleus");
  });

  it("ohne jeden Text ist die Karte nicht spielbar", () => {
    expect(
      matchTileTexts({ front: "![](https://example.com/x.png)", back: "Nucleus" })
    ).toBeNull();
    expect(matchTileTexts({ front: "", back: "die Kurve" })).toBeNull();
    expect(matchTileTexts({ front: "la courbe", back: "   " })).toBeNull();
  });
});

describe("cardKindLabel — Bild-Karten heissen nicht mehr Basic (#612)", () => {
  it("nennt Bild-Occlusion-Karten wie der Deck-Kopf", () => {
    // Der Kopf zaehlt "20 Karten · 10 Bild-Karten" — die Liste nannte dieselbe
    // Karte "Basic".
    expect(cardKindLabel("occlusion")).toBe("Bild-Karte");
  });

  it("behaelt die bekannten Etiketten fuer Text-Karten", () => {
    expect(cardKindLabel("cloze")).toBe("Lückentext");
    expect(cardKindLabel("basic")).toBe("Basic");
    expect(cardKindLabel(undefined)).toBe("Basic");
  });
});

// Muss zum Web passen (apps/web/src/lib/card-display.test.ts) — dieselben
// Erwartungen stehen dort noch einmal (#571).
describe("cardDeleteQuestion", () => {
  it("quotes the card so you see which one is meant", () => {
    expect(cardDeleteQuestion({ front: "Was ist ein Ribosom?", back: "Organell" })).toBe(
      'Soll „Was ist ein Ribosom?" wirklich gelöscht werden? Das lässt sich nicht rückgängig machen.'
    );
  });

  it("shortens a long front to 50 characters plus an ellipsis", () => {
    const front = "A".repeat(80);
    const q = cardDeleteQuestion({ front, back: "b" });
    expect(q).toContain(`„${"A".repeat(50)}…"`);
  });

  it("shows the gap of a cloze card as a blank, never the raw {{c1::…}}", () => {
    const q = cardDeleteQuestion({ front: "Die Hauptstadt ist {{c1::Wien}}", back: "" });
    expect(q).not.toContain("{{c1::");
    expect(q).not.toContain("Wien");
  });

  it("asks without a quote when the front is only an image without a caption", () => {
    expect(cardDeleteQuestion({ front: "![](https://example.com/a.png)", back: "" })).toBe(
      "Soll diese Karte wirklich gelöscht werden? Das lässt sich nicht rückgängig machen."
    );
  });
});
