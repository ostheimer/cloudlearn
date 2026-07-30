import { describe, it, expect } from "vitest";
import { filterBySource, isCardDue } from "./card-source";

type C = { id: string; starred?: boolean; fsrsDue?: string };

const NOW = Date.parse("2026-07-29T12:00:00.000Z");

const cards: C[] = [
  { id: "a", starred: true, fsrsDue: "2026-07-29T08:00:00.000Z" }, // heute fällig
  { id: "b", starred: false, fsrsDue: "2026-08-05T08:00:00.000Z" }, // erst nächste Woche
  { id: "c" }, // starred/fsrsDue nicht gesetzt
  { id: "d", starred: true, fsrsDue: "2026-07-29T12:00:00.000Z" }, // exakt jetzt = fällig
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

  it("due: nur Karten, deren Fälligkeit erreicht ist (#610)", () => {
    expect(filterBySource(cards, "due", new Set(), NOW).map((c) => c.id)).toEqual(["a", "d"]);
  });

  it("ändert die Eingabeliste nicht", () => {
    const copy = [...cards];
    filterBySource(cards, "starred", new Set());
    expect(cards).toEqual(copy);
  });
});

describe("isCardDue", () => {
  it("fällig ab dem geplanten Zeitpunkt, nicht davor", () => {
    expect(isCardDue({ fsrsDue: "2026-07-29T08:00:00.000Z" }, NOW)).toBe(true);
    expect(isCardDue({ fsrsDue: "2026-07-29T12:00:00.000Z" }, NOW)).toBe(true);
    expect(isCardDue({ fsrsDue: "2026-07-30T08:00:00.000Z" }, NOW)).toBe(false);
  });

  it("ohne oder mit kaputtem Datum nie fällig", () => {
    expect(isCardDue({}, NOW)).toBe(false);
    expect(isCardDue({ fsrsDue: "kein datum" }, NOW)).toBe(false);
  });
});
