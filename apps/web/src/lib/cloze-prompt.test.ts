import { describe, expect, it } from "vitest";
import { buildPrompt, hasTypeable } from "./cloze-prompt";

describe("buildPrompt (#569)", () => {
  it("zeigt beim Lückensatz den Strich und erwartet die Lösung", () => {
    const parsed = buildPrompt(
      { front: "Die Hauptstadt von Frankreich ist {{c1::Paris}}.", back: "Paris" },
      false
    );
    expect(parsed).toEqual({
      prompt: "Die Hauptstadt von Frankreich ist ______.",
      answer: "Paris",
      isCloze: true,
    });
  });

  it("die Lücke steckt fest im Text — reverse ändert nichts", () => {
    const parsed = buildPrompt(
      { front: "Berlin liegt an der {{c1::Spree}}.", back: "Spree" },
      true
    );
    expect(parsed.prompt).toBe("Berlin liegt an der ______.");
    expect(parsed.answer).toBe("Spree");
  });

  it("entfernt Bild-Markdown, bevor die Lücke gesucht wird", () => {
    const parsed = buildPrompt(
      {
        front: "![Karte](https://example.com/k.png) Die Donau mündet ins {{c1::Schwarze Meer}}.",
        back: "Schwarzes Meer",
      },
      false
    );
    expect(parsed.prompt).toBe("Die Donau mündet ins ______.");
    expect(parsed.answer).toBe("Schwarze Meer");
  });

  it("kürzt Übersetzungsfragen normaler Karten auf den Begriff", () => {
    const parsed = buildPrompt(
      { front: "Was heißt 'le soleil' auf Deutsch?", back: "die Sonne" },
      false
    );
    expect(parsed).toEqual({ prompt: "le soleil", answer: "die Sonne", isCloze: false });
  });

  it("normale Karten tauschen mit reverse die Seiten", () => {
    const parsed = buildPrompt({ front: "la courbe", back: "die Kurve" }, true);
    expect(parsed).toEqual({ prompt: "die Kurve", answer: "la courbe", isCloze: false });
  });
});

describe("hasTypeable (#569)", () => {
  it("Text- und Lücken-Karten sind nutzbar", () => {
    expect(hasTypeable({ front: "la courbe", back: "die Kurve" })).toBe(true);
    expect(hasTypeable({ front: "Es gilt {{c1::E=mc²}}.", back: "E=mc²" })).toBe(true);
  });

  it("reine Bild-Karten sind ohne Bildanzeige nicht nutzbar", () => {
    expect(
      hasTypeable({ front: "![Zellkern](https://example.com/z.png)", back: "Nucleus" })
    ).toBe(false);
  });

  it("leere Seiten sind nicht nutzbar", () => {
    expect(hasTypeable({ front: "la courbe", back: "" })).toBe(false);
  });
});
