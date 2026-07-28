import { describe, expect, it } from "vitest";
import { matchTileTexts } from "./match-tiles";

describe("matchTileTexts (#569)", () => {
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

  it("entfernt Bild-Markdown und Übersetzungs-Zusätze", () => {
    const tiles = matchTileTexts({
      front: "![Foto](https://example.com/a.png) Was heißt 'le soleil' auf Deutsch?",
      back: "die Sonne",
    });
    expect(tiles?.front).toBe("le soleil");
    expect(tiles?.back).toBe("die Sonne");
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
    expect(matchTileTexts({ front: "![](https://example.com/x.png)", back: "Nucleus" })).toBeNull();
    expect(matchTileTexts({ front: "", back: "die Kurve" })).toBeNull();
  });
});
