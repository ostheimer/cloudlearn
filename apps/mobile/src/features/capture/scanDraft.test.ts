/**
 * Der Scan-Entwurf-Merker (#608): Heikel ist das Wiedereinlesen — ein kaputter
 * oder von einer alten Version geschriebener Eintrag darf höchstens ignoriert
 * werden, nie den Scan-Tab zerlegen. Die Karten haben Lernpunkte gekostet;
 * alles Brauchbare wird gerettet, inklusive der Deck-Id eines
 * teil-gescheiterten Speicherversuchs (Duplikat-Deck-Schutz).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  clearScanDraft,
  loadScanDraft,
  parseScanDraft,
  saveScanDraft,
  type ScanDraft,
} from "./scanDraft";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    setItem: async (k: string, v: string) => void store.set(k, v),
    getItem: async (k: string) => store.get(k) ?? null,
    removeItem: async (k: string) => void store.delete(k),
  },
}));

beforeEach(() => store.clear());

const KEY = "clearn:scandraft";

const card = (front: string, back: string) => ({
  front,
  back,
  type: "basic",
  difficulty: "medium",
  tags: [],
});

const draft = (over: Partial<ScanDraft> = {}): ScanDraft => ({
  cards: [card("Frage", "Antwort")],
  deckTitle: "Bio Kapitel 3",
  savedDeckId: null,
  ...over,
});

describe("scanDraft", () => {
  it("liefert einen gespeicherten Entwurf unverändert zurück", async () => {
    await saveScanDraft(draft({ savedDeckId: "deck-1" }));
    expect(await loadScanDraft()).toEqual(draft({ savedDeckId: "deck-1" }));
  });

  it("gibt null zurück, wenn nichts gemerkt ist", async () => {
    expect(await loadScanDraft()).toBeNull();
  });

  it("löscht den Merker", async () => {
    await saveScanDraft(draft());
    await clearScanDraft();
    expect(store.has(KEY)).toBe(false);
    expect(await loadScanDraft()).toBeNull();
  });

  it("überlebt kaputte Einträge, ohne zu werfen", () => {
    expect(parseScanDraft("{kein json")).toBeNull();
    expect(parseScanDraft(null)).toBeNull();
    expect(parseScanDraft(JSON.stringify("nur ein string"))).toBeNull();
  });

  it("wirft unbrauchbare Karten heraus und füllt fehlende Felder auf", () => {
    const raw = JSON.stringify({
      cards: [{ front: "F", back: "B" }, { front: 5 }, "unsinn"],
      deckTitle: 7,
      savedDeckId: 42,
    });
    expect(parseScanDraft(raw)).toEqual({
      cards: [card("F", "B")],
      deckTitle: "",
      savedDeckId: null,
    });
  });

  it("gibt null zurück, wenn keine brauchbare Karte übrig bleibt", () => {
    const raw = JSON.stringify({ cards: [{ front: 1 }], deckTitle: "x", savedDeckId: null });
    expect(parseScanDraft(raw)).toBeNull();
  });
});
