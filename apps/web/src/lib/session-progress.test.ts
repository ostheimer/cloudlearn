/**
 * Weitermachen einer unterbrochenen Lern-Runde (Web-Gegenstück zu
 * apps/mobile/src/features/review/sessionProgress.test.ts). Heikel ist nicht
 * das Speichern, sondern die Entscheidung, ob eine gemerkte Position noch
 * etwas bedeutet: Zwischen zwei Runden werden Karten angelegt, gelöscht oder
 * entmarkiert, und eine Position, die still auf die falsche Karte zeigt, ist
 * schlimmer als von vorn zu beginnen — man kann es nicht bemerken.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSessionProgress,
  isProgressUsable,
  loadSessionProgress,
  parseSessionProgress,
  saveSessionProgress,
  type SessionProgress,
} from "./session-progress";

function stubLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  });
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const progress = (over: Partial<SessionProgress> = {}): SessionProgress => ({
  index: 8,
  cardId: "card-9",
  source: "all",
  reverse: false,
  total: 40,
  ...over,
});

describe("parseSessionProgress", () => {
  it("reads a stored entry", () => {
    expect(parseSessionProgress(JSON.stringify(progress()))).toEqual(progress());
  });

  it("returns null for nothing stored or unreadable JSON", () => {
    expect(parseSessionProgress(null)).toBeNull();
    expect(parseSessionProgress("")).toBeNull();
    expect(parseSessionProgress("{kaputt")).toBeNull();
  });

  it("rejects entries with an unusable index", () => {
    expect(parseSessionProgress(JSON.stringify(progress({ index: -1 })))).toBeNull();
    expect(parseSessionProgress(JSON.stringify(progress({ index: 1.5 })))).toBeNull();
    // index === total ist eine fertige Runde, keine fortsetzbare.
    expect(parseSessionProgress(JSON.stringify(progress({ index: 40, total: 40 })))).toBeNull();
    expect(parseSessionProgress(JSON.stringify(progress({ index: 99, total: 40 })))).toBeNull();
  });

  it("rejects entries missing the fields the resume depends on", () => {
    expect(parseSessionProgress(JSON.stringify({ ...progress(), cardId: "" }))).toBeNull();
    expect(parseSessionProgress(JSON.stringify({ ...progress(), source: "" }))).toBeNull();
    expect(parseSessionProgress(JSON.stringify({ ...progress(), total: 0 }))).toBeNull();
    const { cardId: _drop, ...ohneCardId } = progress();
    expect(parseSessionProgress(JSON.stringify(ohneCardId))).toBeNull();
  });

  it("treats a missing direction as front-to-back rather than discarding the entry", () => {
    const { reverse: _drop, ...ohneRichtung } = progress();
    expect(parseSessionProgress(JSON.stringify(ohneRichtung))?.reverse).toBe(false);
  });
});

// Das Ergebnis-Feld lässt die Auswertung nach einem Weitermachen die ganze
// Runde zählen („11 von 12"). Es ist strikt optional: Ein Merker von vor dem
// Feld — oder mit kaputtem Inhalt — muss weiter fortsetzen; die Auswertung
// zählt dann nur die aktuelle Sitzung.
describe("Karten-Ergebnisse über eine Unterbrechung merken", () => {
  it("liest eine gespeicherte Ergebnis-Liste wieder ein", () => {
    const withResults = progress({
      results: {
        "card-1": { correct: true, overridden: false },
        "card-2": { correct: false, overridden: true },
      },
    });
    expect(parseSessionProgress(JSON.stringify(withResults))).toEqual(withResults);
  });

  it("lässt den Merker ohne Ergebnis-Feld unangetastet", () => {
    expect(parseSessionProgress(JSON.stringify(progress()))?.results).toBeUndefined();
  });

  it("verwirft kaputte Einträge, behält aber die brauchbaren", () => {
    const raw = JSON.stringify({
      ...progress(),
      results: {
        "card-1": { correct: true, overridden: false },
        "card-2": { correct: "ja", overridden: false },
        "card-3": null,
        "card-4": 7,
      },
    });
    expect(parseSessionProgress(raw)?.results).toEqual({
      "card-1": { correct: true, overridden: false },
    });
  });

  it("überlebt ein komplett kaputtes Ergebnis-Feld", () => {
    const alsListe = JSON.stringify({ ...progress(), results: ["card-1"] });
    const alsText = JSON.stringify({ ...progress(), results: "kaputt" });
    expect(parseSessionProgress(alsListe)).toEqual(progress());
    expect(parseSessionProgress(alsText)).toEqual(progress());
  });
});

describe("isProgressUsable", () => {
  const pile = ["card-1", "card-2", "card-3", "card-9"];

  it("accepts a position that still holds its card", () => {
    expect(isProgressUsable(progress({ index: 3, cardId: "card-9" }), pile, "all")).toBe(true);
  });

  it("declines when nothing was stored", () => {
    expect(isProgressUsable(null, pile, "all")).toBe(false);
  });

  // Der Fall, für den es die Prüfung gibt: Eine Karte wurde gelöscht, jede
  // spätere Position hält jetzt eine andere Karte.
  it("declines when the position moved to another card", () => {
    expect(isProgressUsable(progress({ index: 3, cardId: "card-4" }), pile, "all")).toBe(false);
  });

  it("declines when the pile shrank past the position", () => {
    expect(isProgressUsable(progress({ index: 9, cardId: "card-9" }), pile, "all")).toBe(false);
    expect(isProgressUsable(progress({ index: 0, cardId: "card-1" }), [], "all")).toBe(false);
  });

  // „Nur markierte“ und „Alle“ sind verschiedene Stapel; ein Index in den
  // einen sagt nichts über den anderen, selbst wenn die Ids zufällig passen.
  it("declines when the session was run on a different card source", () => {
    expect(isProgressUsable(progress({ index: 3, cardId: "card-9" }), pile, "starred")).toBe(false);
  });
});

// Ein Deck kann gleichzeitig eine unterbrochene Karteikarten- und eine
// Lückentext-Runde haben, über verschiedene Stapel (der Lückentext lernt nur
// eintippbare Karten). Ein gemeinsamer Schlüssel ließe die zuletzt genutzte
// Lernart die Position der anderen überschreiben.
describe("keeping the modes apart", () => {
  it("stores and reads each mode under its own entry", () => {
    stubLocalStorage();
    saveSessionProgress("deck-1", "flashcards", progress({ index: 8, cardId: "k-9" }));
    saveSessionProgress("deck-1", "cloze", progress({ index: 2, cardId: "l-3" }));

    expect(loadSessionProgress("deck-1", "flashcards")?.cardId).toBe("k-9");
    expect(loadSessionProgress("deck-1", "cloze")?.cardId).toBe("l-3");
  });

  it("keeps decks apart as well", () => {
    stubLocalStorage();
    saveSessionProgress("deck-1", "cloze", progress({ cardId: "aus-deck-1" }));
    expect(loadSessionProgress("deck-2", "cloze")).toBeNull();
  });

  it("clears only the mode it was asked to clear", () => {
    stubLocalStorage();
    saveSessionProgress("deck-1", "flashcards", progress({ cardId: "k-9" }));
    saveSessionProgress("deck-1", "cloze", progress({ cardId: "l-3" }));

    clearSessionProgress("deck-1", "cloze");

    expect(loadSessionProgress("deck-1", "flashcards")?.cardId).toBe("k-9");
    expect(loadSessionProgress("deck-1", "cloze")).toBeNull();
  });

  it("uses the web-wide clearn: key layout", () => {
    const store = stubLocalStorage();
    saveSessionProgress("deck-1", "flashcards", progress());
    expect([...store.keys()]).toEqual(["clearn:lernstand:flashcards:deck-1"]);
  });
});

// Gesperrter localStorage (strenger Privatmodus) oder Server-Rendering ohne
// window: Alles wird zum stillen Nichtstun, nie zum Absturz mitten im Lernen.
describe("blocked or missing storage", () => {
  it("survives a throwing localStorage", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
        removeItem: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(() => saveSessionProgress("deck-1", "flashcards", progress())).not.toThrow();
    expect(loadSessionProgress("deck-1", "flashcards")).toBeNull();
    expect(() => clearSessionProgress("deck-1", "flashcards")).not.toThrow();
  });

  it("survives a missing window (server rendering)", () => {
    expect(() => saveSessionProgress("deck-1", "flashcards", progress())).not.toThrow();
    expect(loadSessionProgress("deck-1", "flashcards")).toBeNull();
    expect(() => clearSessionProgress("deck-1", "flashcards")).not.toThrow();
  });
});
