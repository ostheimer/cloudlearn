import { describe, expect, it } from "vitest";
import { folderDeckCounts } from "./folder-deck-counts";

const folders = [{ id: "f1" }, { id: "f2" }, { id: "f3" }];

describe("folderDeckCounts", () => {
  it("übernimmt die gezählten Ordner", () => {
    expect(folderDeckCounts(folders, { decksByFolder: { f1: 3, f2: 1, f3: 12 } })).toEqual({
      f1: 3,
      f2: 1,
      f3: 12,
    });
  });

  it("leere Ordner fehlen in der Antwort und zählen 0 — nicht 'wird geladen'", () => {
    // Die gruppierte Zählung kennt nur Ordner MIT Decks. Ohne diese Ergänzung
    // stünde auf der Kachel eines leeren Ordners dauerhaft "Wird geladen…".
    expect(folderDeckCounts(folders, { decksByFolder: { f2: 5 } })).toEqual({
      f1: 0,
      f2: 5,
      f3: 0,
    });
  });

  it("gescheiterte Zählung: alle unbekannt (-1), keine erfundene Null", () => {
    expect(folderDeckCounts(folders, null)).toEqual({ f1: -1, f2: -1, f3: -1 });
  });

  it("ohne Ordner ein leeres Ergebnis", () => {
    expect(folderDeckCounts([], { decksByFolder: {} })).toEqual({});
    expect(folderDeckCounts([], null)).toEqual({});
  });

  it("ignoriert Zahlen zu Ordnern, die die Seite nicht zeigt", () => {
    // Die Antwort umfasst ALLE Ordner des Kontos; die Ordnerseite zeigt nur die
    // eigenen Unterordner. Fremde Einträge dürfen nicht mit einsickern.
    expect(folderDeckCounts([{ id: "f1" }], { decksByFolder: { f1: 2, andere: 9 } })).toEqual({
      f1: 2,
    });
  });
});
