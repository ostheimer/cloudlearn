/**
 * Setup-Merker der Lernmodi (#610, Web-Gegenstück zu
 * apps/mobile/src/lib/setupMemory.test.ts). Heikel ist nicht das Speichern,
 * sondern das Wiederanwenden: Eine gemerkte Quelle ohne Karten wäre eine
 * Sackgasse, und eine gemerkte Anzahl muss zum heutigen Vorrat passen —
 * „Alle" soll „Alle" bleiben, auch wenn das Deck gewachsen ist.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  encodeCount,
  loadSetup,
  parseStoredSetup,
  resolveCount,
  resolveSource,
  saveSetup,
} from "./setup-memory";

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

describe("parseStoredSetup", () => {
  it("liest alle Feldtypen", () => {
    const parsed = parseStoredSetup(
      JSON.stringify({
        reverse: true,
        strict: false,
        timed: true,
        typeMC: true,
        typeTF: false,
        typeWritten: true,
        source: "starred",
        count: 12,
      })
    );
    expect(parsed).toEqual({
      reverse: true,
      strict: false,
      timed: true,
      typeMC: true,
      typeTF: false,
      typeWritten: true,
      source: "starred",
      count: 12,
    });
  });

  it("verwirft nur kaputte Felder, nicht den ganzen Merker", () => {
    const parsed = parseStoredSetup(
      JSON.stringify({ reverse: "ja", strict: true, source: 7, count: 2.5 })
    );
    expect(parsed).toEqual({ strict: true });
  });

  it("kennt „all“ als Anzahl", () => {
    expect(parseStoredSetup(JSON.stringify({ count: "all" }))).toEqual({ count: "all" });
  });

  it("liefert null für Müll, leere Objekte und kaputtes JSON", () => {
    expect(parseStoredSetup(null)).toBeNull();
    expect(parseStoredSetup("")).toBeNull();
    expect(parseStoredSetup("{nicht json")).toBeNull();
    expect(parseStoredSetup(JSON.stringify([1, 2]))).toBeNull();
    expect(parseStoredSetup(JSON.stringify({ count: 0 }))).toBeNull();
    expect(parseStoredSetup(JSON.stringify({ count: -3 }))).toBeNull();
  });
});

describe("encodeCount / resolveCount", () => {
  it("speichert „Alle“ als Absicht, nicht als Zahl", () => {
    expect(encodeCount(40, 40)).toBe("all");
    expect(encodeCount(10, 40)).toBe(10);
  });

  it("wendet „Alle“ auf den heutigen Vorrat an", () => {
    expect(resolveCount("all", 50)).toBe(50);
  });

  it("klemmt eine gemerkte Zahl auf den heutigen Vorrat", () => {
    expect(resolveCount(30, 12)).toBe(12);
    expect(resolveCount(10, 40)).toBe(10);
  });

  it("liefert null ohne Merker oder ohne Vorrat", () => {
    expect(resolveCount(undefined, 40)).toBeNull();
    expect(resolveCount(10, 0)).toBeNull();
  });
});

describe("resolveSource", () => {
  it("übernimmt eine Quelle nur, wenn sie wieder Karten hätte", () => {
    expect(resolveSource("starred", { starred: 3, wobbly: 0 })).toBe("starred");
    expect(resolveSource("starred", { starred: 0, wobbly: 5 })).toBeNull();
    expect(resolveSource("wobbly", { starred: 0, wobbly: 5 })).toBe("wobbly");
    expect(resolveSource("wobbly", { starred: 3, wobbly: 0 })).toBeNull();
    expect(resolveSource("all", { starred: 0, wobbly: 0 })).toBe("all");
  });

  it("lässt Unbekanntes auf den Standard fallen", () => {
    expect(resolveSource("due", { starred: 3, wobbly: 3 })).toBeNull();
    expect(resolveSource(undefined, { starred: 3, wobbly: 3 })).toBeNull();
  });
});

describe("saveSetup / loadSetup", () => {
  it("merkt je Deck und Modus getrennt", () => {
    stubLocalStorage();
    saveSetup("deck-1", "cloze", { strict: false, reverse: true, source: "starred" });
    saveSetup("deck-1", "quiz", { count: 10 });
    expect(loadSetup("deck-1", "cloze")).toEqual({
      strict: false,
      reverse: true,
      source: "starred",
    });
    expect(loadSetup("deck-1", "quiz")).toEqual({ count: 10 });
    expect(loadSetup("deck-2", "cloze")).toBeNull();
  });

  it("überlebt gesperrten Speicher (Privatmodus)", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("gesperrt");
        },
        setItem: () => {
          throw new Error("gesperrt");
        },
      },
    });
    expect(() => saveSetup("deck-1", "cloze", { strict: true })).not.toThrow();
    expect(loadSetup("deck-1", "cloze")).toBeNull();
  });
});
