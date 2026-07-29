import { describe, expect, it } from "vitest";
import { cardSideTexts, matchTileTexts } from "./cardDisplay";

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
