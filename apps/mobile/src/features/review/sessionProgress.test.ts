/**
 * Resuming an interrupted Karteikarten session. The risky part is not the
 * storage but the decision whether a stored position still means anything:
 * cards get added, deleted or unstarred between sessions, and a position that
 * silently points at the wrong card is worse than starting over, because the
 * learner has no way to notice.
 */

import { describe, expect, it } from "vitest";
import { isProgressUsable, parseSessionProgress, type SessionProgress } from "./sessionProgress";

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
