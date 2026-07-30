import { describe, expect, it } from "vitest";
import { cardTypeLabel, difficultyLabel } from "./cardLabels";

describe("cardTypeLabel", () => {
  it("übersetzt alle Kartentypen aus contracts.ts", () => {
    expect(cardTypeLabel("basic")).toBe("Frage & Antwort");
    expect(cardTypeLabel("cloze")).toBe("Lückentext");
    expect(cardTypeLabel("mcq")).toBe("Multiple Choice");
    expect(cardTypeLabel("matching")).toBe("Zuordnen");
    expect(cardTypeLabel("occlusion")).toBe("Bild abdecken");
  });

  it("gibt Unbekanntes roh zurück statt es zu verschlucken", () => {
    expect(cardTypeLabel("brandneu")).toBe("brandneu");
    expect(cardTypeLabel("")).toBe("");
  });
});

describe("difficultyLabel", () => {
  it("übersetzt die drei Schwierigkeiten — wie die Deck-Ansicht", () => {
    expect(difficultyLabel("easy")).toBe("Leicht");
    expect(difficultyLabel("medium")).toBe("Mittel");
    expect(difficultyLabel("hard")).toBe("Schwer");
  });

  it("gibt Unbekanntes roh zurück", () => {
    expect(difficultyLabel("unmoeglich")).toBe("unmoeglich");
  });
});
