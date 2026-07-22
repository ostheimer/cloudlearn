import { describe, expect, it } from "vitest";
import { editCardField, isPlainEditableCard, removeCardAt } from "./cardDraft";
import type { Flashcard } from "./api";

function card(front: string, back: string): Flashcard {
  return { front, back, type: "basic", difficulty: "medium", tags: [] };
}

describe("Karten-Vorschau bearbeiten/löschen (#427)", () => {
  const cards = [card("F1", "B1"), card("F2", "B2"), card("F3", "B3")];

  it("ändert nur die angefasste Karte und Seite", () => {
    const next = editCardField(cards, 1, "front", "neu");
    expect(next[1]!.front).toBe("neu");
    expect(next[1]!.back).toBe("B2"); // Rückseite unberührt
    expect(next[0]).toEqual(cards[0]); // Nachbarn unberührt
    expect(next[2]).toEqual(cards[2]);
  });

  it("lässt das Original unverändert (kein Mutieren)", () => {
    editCardField(cards, 0, "back", "x");
    expect(cards[0]!.back).toBe("B1");
  });

  it("entfernt genau eine Karte, Reihenfolge bleibt", () => {
    const next = removeCardAt(cards, 1);
    expect(next.map((c) => c.front)).toEqual(["F1", "F3"]);
  });

  it("kann bis zur leeren Liste löschen", () => {
    let next = [...cards];
    for (let i = cards.length - 1; i >= 0; i--) next = removeCardAt(next, i);
    expect(next).toHaveLength(0);
  });

  it("erlaubt Bearbeiten nur bei schlichten Text-Karten", () => {
    expect(isPlainEditableCard({ front: "Was ist X?" })).toBe(true);
    // Lückentext: einfaches Textfeld würde die {{c1::…}}-Struktur zerstören.
    expect(isPlainEditableCard({ front: "Die Hauptstadt ist {{c1::Berlin}}." })).toBe(false);
    // Bild-Karte: nicht als Text bearbeitbar.
    expect(isPlainEditableCard({ front: "Alt-Text", hasMedia: true })).toBe(false);
  });
});
