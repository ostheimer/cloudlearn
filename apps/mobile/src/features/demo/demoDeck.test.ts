import { describe, expect, it } from "vitest";
import {
  DEMO_CARDS,
  countKnownDemoRatings,
  demoResultBody,
  demoResultTitle,
} from "./demoDeck";

describe("Gast-Demo: Karten (#609)", () => {
  it("hat drei vollständige Karten aus verschiedenen Fächern", () => {
    expect(DEMO_CARDS).toHaveLength(3);
    for (const card of DEMO_CARDS) {
      expect(card.front.trim().length).toBeGreaterThan(0);
      expect(card.back.trim().length).toBeGreaterThan(0);
      expect(card.subject.trim().length).toBeGreaterThan(0);
    }
    expect(new Set(DEMO_CARDS.map((c) => c.subject)).size).toBe(3);
  });
});

describe("Gast-Demo: Zählung (#609)", () => {
  it("zählt „Gut\" und „Leicht\" als gewusst", () => {
    expect(countKnownDemoRatings(["good", "easy"])).toBe(2);
  });

  it("zählt „Schwer\" NICHT als gewusst — wie im echten Lernen (#565)", () => {
    // Rechnete die Demo anders als die App, würde sie in die Irre führen.
    expect(countKnownDemoRatings(["hard"])).toBe(0);
    expect(countKnownDemoRatings(["again", "hard", "good"])).toBe(1);
  });

  it("kommt mit gar keiner Bewertung zurecht", () => {
    expect(countKnownDemoRatings([])).toBe(0);
  });
});

describe("Gast-Demo: Abschluss-Texte (#609)", () => {
  it("lobt, wenn alles gewusst wurde", () => {
    expect(demoResultTitle(3, 3)).toBe("Alles gewusst");
  });

  it("bleibt sachlich, wenn nichts gewusst wurde", () => {
    expect(demoResultTitle(0, 3)).toBe("Noch nichts sicher");
  });

  it("nennt den Zwischenstand ohne Wertung", () => {
    expect(demoResultTitle(2, 3)).toBe("Fast geschafft");
  });

  it("sagt im Ergebnis ehrlich, dass nichts gespeichert wird", () => {
    const body = demoResultBody(2, 3);
    expect(body).toContain("3 Karten, davon 2 gewusst");
    expect(body).toContain("nichts davon gespeichert");
  });

  it("beugt die Einzahl richtig", () => {
    expect(demoResultBody(1, 1)).toContain("1 Karte, davon 1 gewusst");
  });
});
