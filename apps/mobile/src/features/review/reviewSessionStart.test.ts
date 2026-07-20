/**
 * start() gained a start index so an interrupted deck session can resume.
 * These tests pin the boundaries: a bad index must never leave the session
 * pointing outside its own card list.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { useReviewSession, type ReviewCard } from "./reviewSession";

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
