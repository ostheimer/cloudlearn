import { describe, expect, it } from "vitest";
import { filterDueCardsByDeckIds } from "./learnFilters";

describe("filterDueCardsByDeckIds", () => {
  it("returns empty array when cards is empty", () => {
    expect(filterDueCardsByDeckIds([], ["d1", "d2"])).toEqual([]);
  });

  it("returns empty array when no card matches deck IDs", () => {
    const cards = [
      { deckId: "d3", id: "1" },
      { deckId: "d4", id: "2" },
    ];
    expect(filterDueCardsByDeckIds(cards, ["d1", "d2"])).toEqual([]);
  });

  it("returns only cards whose deckId is in deckIds", () => {
    const cards = [
      { deckId: "d1", id: "1" },
      { deckId: "d2", id: "2" },
      { deckId: "d3", id: "3" },
    ];
    expect(filterDueCardsByDeckIds(cards, ["d1", "d3"])).toEqual([
      { deckId: "d1", id: "1" },
      { deckId: "d3", id: "3" },
    ]);
  });

  it("returns all cards when all deckIds match", () => {
    const cards = [
      { deckId: "d1", id: "1" },
      { deckId: "d1", id: "2" },
    ];
    expect(filterDueCardsByDeckIds(cards, ["d1"])).toEqual(cards);
  });
});
