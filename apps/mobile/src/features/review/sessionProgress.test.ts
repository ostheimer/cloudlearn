/**
 * Resuming an interrupted Karteikarten session. The risky part is not the
 * storage but the decision whether a stored position still means anything:
 * cards get added, deleted or unstarred between sessions, and a position that
 * silently points at the wrong card is worse than starting over, because the
 * learner has no way to notice.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  clearSessionProgress,
  isProgressUsable,
  loadSessionProgress,
  parseSessionProgress,
  saveSessionProgress,
  type SessionProgress,
} from "./sessionProgress";

// In-memory stand-in for the device store, so the key layout can be asserted.
const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    setItem: async (k: string, v: string) => void store.set(k, v),
    getItem: async (k: string) => store.get(k) ?? null,
    removeItem: async (k: string) => void store.delete(k),
  },
}));

beforeEach(() => store.clear());

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
    // index === total is a finished session, not a resumable one.
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

describe("isProgressUsable", () => {
  const pile = ["card-1", "card-2", "card-3", "card-9"];

  it("accepts a position that still holds its card", () => {
    expect(isProgressUsable(progress({ index: 3, cardId: "card-9" }), pile, "all")).toBe(true);
  });

  it("declines when nothing was stored", () => {
    expect(isProgressUsable(null, pile, "all")).toBe(false);
  });

  // The scenario this check exists for: a card was deleted, so every later
  // position now holds a different card.
  it("declines when the position moved to another card", () => {
    expect(isProgressUsable(progress({ index: 3, cardId: "card-4" }), pile, "all")).toBe(false);
  });

  it("declines when the pile shrank past the position", () => {
    expect(isProgressUsable(progress({ index: 9, cardId: "card-9" }), pile, "all")).toBe(false);
    expect(isProgressUsable(progress({ index: 0, cardId: "card-1" }), [], "all")).toBe(false);
  });

  // "Nur markierte" and "Alle" are different piles; an index into one says
  // nothing about the other, even when the card ids happen to line up.
  it("declines when the session was run on a different card source", () => {
    expect(isProgressUsable(progress({ index: 3, cardId: "card-9" }), pile, "starred")).toBe(false);
  });
});

// One deck can have a Karteikarten round and a Lückentext round interrupted at
// the same time, over different piles (Lückentext only studies typeable cards).
// A shared key would let whichever mode ran last overwrite the other position.
describe("keeping the modes apart", () => {
  it("stores and reads each mode under its own entry", async () => {
    await saveSessionProgress("deck-1", "flashcards", progress({ index: 8, cardId: "k-9" }));
    await saveSessionProgress("deck-1", "cloze", progress({ index: 2, cardId: "l-3" }));

    expect((await loadSessionProgress("deck-1", "flashcards"))?.cardId).toBe("k-9");
    expect((await loadSessionProgress("deck-1", "cloze"))?.cardId).toBe("l-3");
  });

  it("keeps decks apart as well", async () => {
    await saveSessionProgress("deck-1", "cloze", progress({ cardId: "aus-deck-1" }));
    expect(await loadSessionProgress("deck-2", "cloze")).toBeNull();
  });

  it("clears only the mode it was asked to clear", async () => {
    await saveSessionProgress("deck-1", "flashcards", progress({ cardId: "k-9" }));
    await saveSessionProgress("deck-1", "cloze", progress({ cardId: "l-3" }));

    await clearSessionProgress("deck-1", "cloze");

    expect((await loadSessionProgress("deck-1", "flashcards"))?.cardId).toBe("k-9");
    expect(await loadSessionProgress("deck-1", "cloze")).toBeNull();
  });
});
