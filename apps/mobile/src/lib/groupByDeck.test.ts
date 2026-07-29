import { describe, expect, it } from "vitest";
import { groupCardsByDeck } from "./groupByDeck";

const card = (id: string, deckId: string) => ({ id, deckId });

describe("groupCardsByDeck", () => {
  it("zieht Karten desselben Decks zusammen, Deck-Reihenfolge nach erstem Auftreten", () => {
    const mixed = [
      card("a1", "bio"),
      card("b1", "englisch"),
      card("a2", "bio"),
      card("c1", "mathe"),
      card("b2", "englisch"),
    ];
    expect(groupCardsByDeck(mixed).map((c) => c.id)).toEqual([
      "a1",
      "a2",
      "b1",
      "b2",
      "c1",
    ]);
  });

  it("lässt die Reihenfolge innerhalb eines Decks unangetastet", () => {
    const single = [card("x3", "d"), card("x1", "d"), card("x2", "d")];
    expect(groupCardsByDeck(single).map((c) => c.id)).toEqual(["x3", "x1", "x2"]);
  });

  it("gibt eine leere Liste unverändert zurück", () => {
    expect(groupCardsByDeck([])).toEqual([]);
  });
});
