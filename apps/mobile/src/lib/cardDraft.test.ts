import { describe, expect, it } from "vitest";
import {
  blankCard,
  editCardField,
  isCardEditable,
  moveCard,
  nonEmptyCards,
  removeCardAt,
} from "./cardDraft";
import { summarizeCardMedia } from "./cardMedia";
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

  it("macht schlichte Text-Karten editierbar — mit der ECHTEN Medien-Analyse", () => {
    // Der Bug in #456 lief genau hier auf: summarizeCardMedia setzt plainFront/
    // plainBack IMMER, also machte die alte Prüfung jede Karte „unbearbeitbar".
    // Dieser Test füttert die echte Analyse und wäre damals rot gewesen.
    const plain = { front: "Was ist ein Primärschlüssel?", back: "Eindeutige Kennung." };
    expect(isCardEditable(plain, summarizeCardMedia(plain))).toBe(true);
  });

  it("sperrt Lückentext und Bild-Karten fürs Bearbeiten (nur löschen)", () => {
    const cloze = { front: "Die Hauptstadt ist {{c1::Berlin}}.", back: "" };
    expect(isCardEditable(cloze, summarizeCardMedia(cloze))).toBe(false);

    const image = {
      front: "![Diagramm](https://example.com/x.png)",
      back: "Beschreibung",
    };
    expect(isCardEditable(image, summarizeCardMedia(image))).toBe(false);
  });

  it("liefert eine leere, editierbare Karte zum Ausfüllen", () => {
    const blank = blankCard();
    expect(blank.front).toBe("");
    expect(blank.back).toBe("");
    expect(blank.type).toBe("basic");
    // Muss editierbar sein, sonst könnte man die hinzugefügte Karte nicht füllen.
    expect(isCardEditable(blank, summarizeCardMedia(blank))).toBe(true);
  });

  it("verschiebt eine Karte an eine neue Stelle (Reihenfolge, #427)", () => {
    const list = [card("A", ""), card("B", ""), card("C", ""), card("D", "")];
    // B (Index 1) ans Ende
    expect(moveCard(list, 1, 3).map((c) => c.front)).toEqual(["A", "C", "D", "B"]);
    // C (Index 2) an den Anfang
    expect(moveCard(list, 2, 0).map((c) => c.front)).toEqual(["C", "A", "B", "D"]);
    // eins hoch (Nachbartausch), wie beim Ziehen um eine Zeile
    expect(moveCard(list, 2, 1).map((c) => c.front)).toEqual(["A", "C", "B", "D"]);
  });

  it("lässt die Liste bei unsinnigen Indizes unverändert", () => {
    const list = [card("A", ""), card("B", "")];
    expect(moveCard(list, 0, 0)).toBe(list); // gleiche Stelle
    expect(moveCard(list, 0, 5)).toBe(list); // außerhalb
    expect(moveCard(list, -1, 1)).toBe(list);
  });

  it("überspringt leere Karten beim Speichern, füllt gefüllte durch", () => {
    const mixed = [card("F1", "B1"), blankCard(), card("", "  "), card("", "nur Antwort")];
    const kept = nonEmptyCards(mixed);
    expect(kept.map((c) => [c.front, c.back])).toEqual([
      ["F1", "B1"],
      ["", "nur Antwort"], // eine Seite reicht
    ]);
  });
});
