import { describe, expect, it, vi } from "vitest";
import { resolveSessionResume as mobileResume, parseSessionCardIds, type ResumableSession } from "../../../mobile/src/features/review/sessionResume";
import { resolveSessionResume as webResume } from "./session-resume";
import { useReviewSession, missedCardsFrom, storedResultsFrom, sessionResultCounts } from "../../../mobile/src/features/review/reviewSession";
import { resultsBefore, flashcardResults } from "./flashcard-results";
import { beginSessionAward } from "../../../mobile/src/lib/learn-session-lp";

const all = ["a", "b", "c", "d"].map((id) => ({ id, front: id, back: id }));
const right = { correct: true, overridden: false };
const wrong = { correct: false, overridden: false };
const progress = (over: Partial<ResumableSession> = {}): ResumableSession => ({
  index: 2, cardId: "c", source: "due", total: 4, cardIds: ["a", "b", "c", "d"], results: { a: right, b: wrong }, ...over,
});

for (const [platform, resolve] of [["mobile", mobileResume], ["web", webResume]] as const) {
  describe(`${platform}: interrupted due session`, () => {
    it("keeps the original order, answered results and next card after due filtering", () => {
      const resumed = resolve(progress(), all.slice(1), "due", all)!;
      expect(resumed.cards.map((card) => card.id)).toEqual(["a", "b", "c", "d"]);
      expect(resumed.index).toBe(2);
      expect(resumed.cards[resumed.index]?.id).toBe("c");
    });
    it("does not add newly due/newly created cards or depend on request ordering", () => {
      const extra = { id: "new", front: "new", back: "new" };
      const resumed = resolve(progress(), [extra, ...all].reverse(), "due", [extra, ...all].reverse())!;
      expect(resumed.cards.map((card) => card.id)).toEqual(["a", "b", "c", "d"]);
    });
    it("can resume when all original cards are now outside the due filter", () => {
      const resumed = resolve(progress(), [], "due", all)!;
      expect(resumed.cards[resumed.index]?.id).toBe("c");
    });
    it("drops deleted cards and resumes at the next surviving original card", () => {
      const surviving = all.filter((card) => card.id !== "a" && card.id !== "c");
      const resumed = resolve(progress(), surviving, "due", surviving)!;
      expect(resumed.cards.map((card) => card.id)).toEqual(["b", "d"]);
      expect(resumed.index).toBe(1);
    });
    it("skips an already answered visible cloze card without rating it twice", () => {
      const resumed = resolve(progress({ results: { a: right, b: wrong, c: right } }), [all[3]!], "due", all)!;
      expect(resumed.index).toBe(3);
      expect(resumed.cards[resumed.index]?.id).toBe("d");
    });
    it("returns the completed summary position after the last cloze answer", () => {
      const resumed = resolve(progress({ index: 3, cardId: "d", results: { a: right, b: wrong, c: right, d: right } }), [], "due", all)!;
      expect(resumed.index).toBe(resumed.cards.length);
    });
    it("restores legacy results by ID when their due positions moved", () => {
      const { cardIds: _old, ...legacy } = progress();
      const resumed = resolve(legacy, all.slice(1), "due", all)!;
      expect(resumed.cards.map((card) => card.id)).toEqual(["a", "b", "c", "d"]);
      expect(resumed.index).toBe(2);
    });
    it("does not invent answers for old bookmarks without results or a snapshot", () => {
      const { cardIds: _old, results: _answers, ...legacy } = progress();
      const resumed = resolve(legacy, all.slice(2), "due", all)!;
      expect(resumed.cards.map((card) => card.id)).toEqual(["c", "d"]);
      expect(resumed.index).toBe(0);
      expect(resolve(legacy, [all[3]!], "due", all)).toBeNull();
    });
    it.each(["all", "starred", "wobbly"])("%s skips an already submitted visible cloze answer", (source) => {
      const saved = progress({ index: 0, cardId: "a", source, results: { a: right } });
      const resumed = resolve(saved, all, source, all)!;
      expect(resumed.cards.map((card) => card.id)).toEqual(["a", "b", "c", "d"]);
      expect(resumed.index).toBe(1);
      expect(resultsBefore(resumed.cards, resumed.index, saved.results)).toEqual({ a: right });
    });
    it.each(["all", "starred", "wobbly"])("%s opens the summary after an already submitted final answer", (source) => {
      const saved = progress({ index: 3, cardId: "d", source, results: { a: right, b: wrong, c: right, d: right } });
      const resumed = resolve(saved, all, source, all)!;
      expect(resumed.index).toBe(resumed.cards.length);
      expect(resultsBefore(resumed.cards, resumed.index, saved.results)).toEqual(saved.results);
    });
    it("keeps a different source or changed non-due pile from applying a stale index", () => {
      expect(resolve(progress(), all, "all", all)).toBeNull();
      expect(resolve(progress({ source: "all" }), all.slice(1), "all", all)).toBeNull();
    });
  });
}

describe("resume summaries, review and LP boundaries", () => {
  it("rates only the two remaining mobile cards and preserves the first sitting in summary/retry", async () => {
    const saved = progress();
    const resumed = mobileResume(saved, all.slice(1), "due", all)!;
    useReviewSession.getState().start(resumed.cards, resumed.index, "deck", saved.results);
    expect(useReviewSession.getState().canGoBack()).toBe(false);
    const ratings = [useReviewSession.getState().rateCurrent("good"), useReviewSession.getState().rateCurrent("easy")];
    expect(ratings.map((result) => result?.cardId)).toEqual(["c", "d"]);
    const state = useReviewSession.getState();
    expect(state.completed).toBe(true);
    const missed = missedCardsFrom(state.cards, state.history, state.ratingHistory);
    expect(missed.map((card) => card.id)).toEqual(["b"]);
    expect(sessionResultCounts(state.cards.length, state.startIndex, state.seededCount, missed.length)).toEqual({ total: 4, known: 3 });
    expect(storedResultsFrom(state.cards, state.history, state.ratingHistory)).toEqual({ a: right, b: wrong, c: right, d: right });
    const awardState = { finalized: false, inFlight: null };
    const award = vi.fn(async () => { awardState.finalized = true; });
    await beginSessionAward(awardState, ratings.length, award);
    await beginSessionAward(awardState, ratings.length, award);
    expect(award).toHaveBeenCalledTimes(1);
  });
  it("carries the web summary through a second interruption without losing old failures", () => {
    const first = webResume(progress(), all.slice(1), "due", all)!;
    const firstResults = flashcardResults(first.cards, 3, resultsBefore(first.cards, first.index, progress().results), [{ index: 2, rating: "good" }]);
    const second = webResume(progress({ index: 3, cardId: "d", results: firstResults }), [all[1]!, all[3]!], "due", all)!;
    expect(second.cards[second.index]?.id).toBe("d");
    const summary = flashcardResults(second.cards, 4, resultsBefore(second.cards, second.index, firstResults), [{ index: 3, rating: "easy" }]);
    expect(summary).toEqual({ a: right, b: wrong, c: right, d: right });
  });
  it("an exhausted snapshot shows the mobile result without making its last card rateable", () => {
    const resumed = mobileResume(progress(), [], "due", all.slice(0, 2))!;
    useReviewSession.getState().start(resumed.cards, resumed.index, "deck", progress().results);
    expect(useReviewSession.getState().completed).toBe(true);
    expect(useReviewSession.getState().rateCurrent("good")).toBeNull();
    expect(useReviewSession.getState().canGoBack()).toBe(false);
  });
  it("rejects malformed snapshot order, duplicates and length mismatch", () => {
    expect(parseSessionCardIds(["a", "b", "c", "d"], progress())).toEqual(["a", "b", "c", "d"]);
    expect(parseSessionCardIds(["a", "a", "c", "d"], progress())).toBeUndefined();
    expect(parseSessionCardIds(["a", "b", "d", "c"], progress())).toBeUndefined();
    expect(parseSessionCardIds(["a", "b", "c"], progress())).toBeUndefined();
  });
});
