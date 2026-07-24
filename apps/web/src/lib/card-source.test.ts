import { describe, it, expect } from "vitest";
import { filterBySource } from "./card-source";

type C = { id: string; starred?: boolean };

const cards: C[] = [
  { id: "a", starred: true },
  { id: "b", starred: false },
  { id: "c" }, // starred nicht gesetzt
  { id: "d", starred: true },
];

describe("filterBySource", () => {
  it("all: gibt jede Karte zurück", () => {
    expect(filterBySource(cards, "all", new Set()).map((c) => c.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("starred: nur Karten mit starred === true (fehlend zählt nicht)", () => {
    expect(filterBySource(cards, "starred", new Set()).map((c) => c.id)).toEqual(["a", "d"]);
  });

  it("wobbly: nur Karten, deren id in wobblyIds steht", () => {
    const ids = new Set(["b", "c"]);
    expect(filterBySource(cards, "wobbly", ids).map((c) => c.id)).toEqual(["b", "c"]);
  });

  it("wobbly ohne IDs: leer", () => {
    expect(filterBySource(cards, "wobbly", new Set())).toEqual([]);
  });

  it("ändert die Eingabeliste nicht", () => {
    const copy = [...cards];
    filterBySource(cards, "starred", new Set());
    expect(cards).toEqual(copy);
  });
});
