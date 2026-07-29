/**
 * start() gained a start index so an interrupted deck session can resume.
 * These tests pin the boundaries: a bad index must never leave the session
 * pointing outside its own card list.
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  useReviewSession,
  missedCardsFrom,
  storedResultsFrom,
  sessionResultCounts,
  type ReviewCard,
} from "./reviewSession";

const cards: ReviewCard[] = [
  { id: "a", front: "1", back: "1" },
  { id: "b", front: "2", back: "2" },
  { id: "c", front: "3", back: "3" },
];

beforeEach(() => {
  useReviewSession.getState().start([]);
});

describe("start with a resume index", () => {
  it("starts at the first card when no index is given", () => {
    useReviewSession.getState().start(cards);
    expect(useReviewSession.getState().index).toBe(0);
  });

  it("starts at the requested card", () => {
    useReviewSession.getState().start(cards, 2);
    expect(useReviewSession.getState().index).toBe(2);
    expect(useReviewSession.getState().completed).toBe(false);
  });

  it("clamps an index past the end to the last card", () => {
    useReviewSession.getState().start(cards, 99);
    expect(useReviewSession.getState().index).toBe(2);
  });

  it("clamps a negative index to the first card", () => {
    useReviewSession.getState().start(cards, -5);
    expect(useReviewSession.getState().index).toBe(0);
  });

  it("keeps an empty session at zero and marks it completed", () => {
    useReviewSession.getState().start([], 4);
    expect(useReviewSession.getState().index).toBe(0);
    expect(useReviewSession.getState().completed).toBe(true);
  });

  // The skipped cards were rated and sent in the earlier session; stepping back
  // into them would offer a second rating for a card that already has one.
  it("cannot step back into the cards that were skipped", () => {
    useReviewSession.getState().start(cards, 2);
    expect(useReviewSession.getState().canGoBack()).toBe(false);
    expect(useReviewSession.getState().goBack()).toBe(false);
    expect(useReviewSession.getState().index).toBe(2);
  });

  it("resets the counters of a previous session", () => {
    useReviewSession.getState().start(cards);
    useReviewSession.getState().rateCurrent("again");
    useReviewSession.getState().start(cards, 1);
    const state = useReviewSession.getState();
    expect(state.swipedLeft).toBe(0);
    expect(state.swipedRight).toBe(0);
    expect(state.ratingHistory).toEqual([]);
    expect(state.revealed).toBe(false);
  });
});

// „Weitermachen" mit gespeicherten Ergebnissen (#595): Die Vor-Sitzung wird
// wieder eingefüllt, damit die Auswertung die ganze Runde zählt und alte
// Fehler im „Nur die nicht gewussten"-Stapel bleiben.
describe("resume with stored results (#595)", () => {
  const priorResults = {
    a: { correct: true, overridden: false },
    b: { correct: false, overridden: false },
  };

  it("seeds the previous session's results below the entry card", () => {
    useReviewSession.getState().start(cards, 2, "deck-1", priorResults);
    const state = useReviewSession.getState();
    expect(state.startIndex).toBe(2);
    expect(state.seededCount).toBe(2);
    expect(state.history).toEqual([0, 1]);
    expect(state.ratingHistory).toEqual(["good", "again"]);
    expect(state.swipedRight).toBe(1);
    expect(state.swipedLeft).toBe(1);
  });

  it("counts the whole round in the summary after resuming", () => {
    useReviewSession.getState().start(cards, 2, "deck-1", priorResults);
    useReviewSession.getState().rateCurrent("good");
    const state = useReviewSession.getState();
    expect(state.completed).toBe(true);
    const missed = missedCardsFrom(state.cards, state.history, state.ratingHistory);
    // Der Fehler von VOR der Unterbrechung (Karte b) bleibt im Stapel.
    expect(missed.map((card) => card.id)).toEqual(["b"]);
    expect(
      sessionResultCounts(state.cards.length, state.startIndex, state.seededCount, missed.length),
    ).toEqual({ total: 3, known: 2 });
  });

  it("counts only the current sitting for old bookmarks without results", () => {
    useReviewSession.getState().start(cards, 2, "deck-1");
    useReviewSession.getState().rateCurrent("again");
    const state = useReviewSession.getState();
    const missed = missedCardsFrom(state.cards, state.history, state.ratingHistory);
    expect(
      sessionResultCounts(state.cards.length, state.startIndex, state.seededCount, missed.length),
    ).toEqual({ total: 1, known: 0 });
  });

  it("keeps the back button away from seeded entries", () => {
    useReviewSession.getState().start(cards, 2, "deck-1", priorResults);
    expect(useReviewSession.getState().canGoBack()).toBe(false);
    expect(useReviewSession.getState().goBack()).toBe(false);
    // Nach einer eigenen Bewertung geht genau ein Schritt zurück …
    useReviewSession.getState().rateCurrent("good");
    expect(useReviewSession.getState().canGoBack()).toBe(true);
    expect(useReviewSession.getState().goBack()).toBe(true);
    expect(useReviewSession.getState().index).toBe(2);
    // … und dann ist wieder Schluss: die eingefüllten Einträge sind tabu.
    expect(useReviewSession.getState().canGoBack()).toBe(false);
    expect(useReviewSession.getState().goBack()).toBe(false);
  });

  it("resets seeding for follow-up rounds", () => {
    useReviewSession.getState().start(cards, 2, "deck-1", priorResults);
    useReviewSession.getState().start(cards); // „Alle nochmal"
    const state = useReviewSession.getState();
    expect(state.startIndex).toBe(0);
    expect(state.seededCount).toBe(0);
    expect(state.history).toEqual([]);
  });
});

describe("storedResultsFrom", () => {
  it("stores the last rating per card as gewusst / nicht gewusst", () => {
    useReviewSession.getState().start(cards);
    useReviewSession.getState().rateCurrent("again");
    useReviewSession.getState().rateCurrent("easy");
    const state = useReviewSession.getState();
    expect(storedResultsFrom(state.cards, state.history, state.ratingHistory)).toEqual({
      a: { correct: false, overridden: false },
      b: { correct: true, overridden: false },
    });
  });

  it("carries seeded results forward for a second interruption", () => {
    useReviewSession.getState().start(cards, 2, "deck-1", {
      a: { correct: true, overridden: false },
      b: { correct: false, overridden: false },
    });
    const state = useReviewSession.getState();
    expect(storedResultsFrom(state.cards, state.history, state.ratingHistory)).toEqual({
      a: { correct: true, overridden: false },
      b: { correct: false, overridden: false },
    });
  });
});
