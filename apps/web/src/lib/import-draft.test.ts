/**
 * Der Import-Entwurf-Merker (#608): Heikel ist nicht das Speichern, sondern
 * das Wiedereinlesen — ein kaputter oder von einer alten Version geschriebener
 * Eintrag darf höchstens ignoriert werden, nie die Scan-Seite zerlegen. Die
 * Karten haben Lernpunkte gekostet; alles Brauchbare wird gerettet.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { clearImportDraft, loadImportDraft, saveImportDraft } from "./import-draft";

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

const KEY = "clearn:importdraft";

const card = (front: string, back: string) => ({
  front,
  back,
  type: "basic",
  difficulty: "medium",
  tags: [],
});

describe("import-draft", () => {
  it("liefert einen gespeicherten Entwurf unverändert zurück", () => {
    stubLocalStorage();
    saveImportDraft({
      cards: [card("Frage", "Antwort")],
      newDeckTitle: "Bio Kapitel 3",
      targetDeckId: "deck-1",
    });
    expect(loadImportDraft()).toEqual({
      cards: [card("Frage", "Antwort")],
      newDeckTitle: "Bio Kapitel 3",
      targetDeckId: "deck-1",
    });
  });

  it("gibt null zurück, wenn nichts gemerkt ist", () => {
    stubLocalStorage();
    expect(loadImportDraft()).toBeNull();
  });

  it("löscht den Merker", () => {
    const store = stubLocalStorage();
    saveImportDraft({ cards: [card("a", "b")], newDeckTitle: "x", targetDeckId: null });
    clearImportDraft();
    expect(store.has(KEY)).toBe(false);
    expect(loadImportDraft()).toBeNull();
  });

  it("überlebt kaputte Einträge, ohne zu werfen", () => {
    stubLocalStorage({ [KEY]: "{kein json" });
    expect(loadImportDraft()).toBeNull();
  });

  it("wirft unbrauchbare Karten heraus und füllt fehlende Felder auf", () => {
    stubLocalStorage({
      [KEY]: JSON.stringify({
        cards: [{ front: "F", back: "B" }, { front: 5 }, "unsinn"],
        newDeckTitle: 7,
        targetDeckId: 42,
      }),
    });
    expect(loadImportDraft()).toEqual({
      cards: [card("F", "B")],
      newDeckTitle: "Neue Karten",
      targetDeckId: null,
    });
  });

  it("gibt null zurück, wenn keine brauchbare Karte übrig bleibt", () => {
    stubLocalStorage({
      [KEY]: JSON.stringify({ cards: [{ front: 1 }], newDeckTitle: "x", targetDeckId: null }),
    });
    expect(loadImportDraft()).toBeNull();
  });

  it("tut ohne window (Server-Rendering) einfach nichts", () => {
    expect(loadImportDraft()).toBeNull();
    expect(() =>
      saveImportDraft({ cards: [card("a", "b")], newDeckTitle: "x", targetDeckId: null })
    ).not.toThrow();
    expect(() => clearImportDraft()).not.toThrow();
  });
});
