import { describe, expect, it } from "vitest";
import { DEFAULT_DECK_SORT, parseDeckSort, sortDecks } from "./deckSort";

/**
 * Reihenfolge der Deck-Liste (#614). Spiegelt apps/web/src/lib/deck-sort.test.ts
 * — beide Plattformen müssen bei denselben Daten dieselbe Ordnung zeigen, sonst
 * hat dasselbe Konto zwei Bibliotheken.
 */
const decks = [
  { id: "b", title: "Biologie", createdAt: "2026-07-10T10:00:00.000Z" },
  { id: "a", title: "Andere", createdAt: "2026-07-20T10:00:00.000Z" },
  { id: "z", title: "Zebra", createdAt: "2026-07-01T10:00:00.000Z" },
];

describe("sortDecks", () => {
  it("sortiert alphabetisch", () => {
    expect(sortDecks(decks, "alpha").map((d) => d.title)).toEqual([
      "Andere",
      "Biologie",
      "Zebra",
    ]);
  });

  it("sortiert Neueste zuerst", () => {
    expect(sortDecks(decks, "created").map((d) => d.title)).toEqual([
      "Andere",
      "Biologie",
      "Zebra",
    ]);
  });

  it("sortiert Fällige zuerst und lässt Decks ohne Fällige NICHT verschwinden", () => {
    const sorted = sortDecks(decks, "due", { dueByDeck: { z: 12, b: 3 } });
    expect(sorted.map((d) => d.title)).toEqual(["Zebra", "Biologie", "Andere"]);
    // „Andere" hat keine fälligen Karten und rutscht nach hinten — aber es
    // bleibt in der Liste. Ein Filter hätte Decks unsichtbar gemacht.
    expect(sorted).toHaveLength(3);
  });

  it("sortiert zuletzt Gelerntes zuerst, nie Gelerntes ans Ende", () => {
    const sorted = sortDecks(decks, "learned", {
      lastLearnedByDeck: {
        b: "2026-07-29T18:00:00.000Z",
        z: "2026-07-25T08:00:00.000Z",
      },
    });
    expect(sorted.map((d) => d.title)).toEqual(["Biologie", "Zebra", "Andere"]);
  });

  it("entscheidet bei Gleichstand nach dem Titel, damit nichts springt", () => {
    const tie = [
      { id: "1", title: "Zebra", createdAt: "2026-07-10T10:00:00.000Z" },
      { id: "2", title: "Apfel", createdAt: "2026-07-10T10:00:00.000Z" },
    ];
    expect(sortDecks(tie, "created").map((d) => d.title)).toEqual(["Apfel", "Zebra"]);
    // Auch ohne jede Fällig-Zahl bleibt die Ordnung bestimmt.
    expect(sortDecks(tie, "due", { dueByDeck: {} }).map((d) => d.title)).toEqual([
      "Apfel",
      "Zebra",
    ]);
    expect(sortDecks(tie, "learned", { lastLearnedByDeck: {} }).map((d) => d.title)).toEqual([
      "Apfel",
      "Zebra",
    ]);
  });

  it("verändert die übergebene Liste nicht", () => {
    const input = [...decks];
    sortDecks(input, "alpha");
    expect(input.map((d) => d.id)).toEqual(["b", "a", "z"]);
  });

  it("kommt ohne Zusatzdaten aus", () => {
    // Solange die Zeitstempel noch nicht geladen sind, darf die Liste nicht
    // leer bleiben oder werfen — sie sortiert dann nach dem Titel.
    expect(sortDecks(decks, "learned").map((d) => d.title)).toEqual([
      "Andere",
      "Biologie",
      "Zebra",
    ]);
    expect(sortDecks(decks, "due").map((d) => d.title)).toEqual([
      "Andere",
      "Biologie",
      "Zebra",
    ]);
  });

  it("nimmt nur bekannte Werte und fällt sonst auf die Voreinstellung", () => {
    expect(parseDeckSort("alpha")).toBe("alpha");
    expect(parseDeckSort("due")).toBe("due");
    expect(parseDeckSort("learned")).toBe("learned");
    expect(parseDeckSort("created")).toBe("created");
    expect(parseDeckSort("unsinn")).toBe(DEFAULT_DECK_SORT);
    expect(parseDeckSort(null)).toBe(DEFAULT_DECK_SORT);
    // Voreinstellung ist die bisherige Ordnung: ein Update darf die Bibliothek
    // nicht ohne Zutun umsortieren.
    expect(DEFAULT_DECK_SORT).toBe("created");
  });

  it("bleibt bei leerer Liste leer", () => {
    for (const sort of ["alpha", "created", "due", "learned"] as const) {
      expect(sortDecks([], sort)).toEqual([]);
    }
  });
});
