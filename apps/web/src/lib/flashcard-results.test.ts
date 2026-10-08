import { describe, expect, it } from "vitest";
import { flashcardResults, resultsBefore } from "./flashcard-results";
import { parseSessionProgress } from "./session-progress";
import { pickNewerProgress } from "./progress-merge";

const cards = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
const wrong = { correct: false, overridden: false };
const right = { correct: true, overridden: false };

describe("flashcard answers across interrupted sessions", () => {
  it("restores prior correct and incorrect answers from the newer remote bookmark", () => {
    const local = { index: 2, cardId: "c", source: "all", reverse: false, total: 4, results: { a: wrong, b: right }, savedAt: "2026-09-05T10:00:00Z" };
    const remote = parseSessionProgress(JSON.stringify({ ...local, savedAt: "2026-09-05T10:00:01Z" }));
    const chosen = pickNewerProgress(local, remote)!;
    const seed = resultsBefore(cards, chosen.index, chosen.results);
    expect(seed).toEqual({ a: wrong, b: right });
    const final = flashcardResults(cards, 4, seed, [{ index: 2, rating: "hard" }, { index: 3, rating: "easy" }]);
    expect(Object.values(final).filter((r) => r.correct)).toHaveLength(2);
    expect(cards.filter((card) => final[card.id]?.correct === false).map((card) => card.id)).toEqual(["a", "c"]);
    expect(Object.keys(final)).toHaveLength(4);
  });
  it("does not seed future or foreign cards and starts clean when not resuming", () => {
    const stored = { a: right, b: wrong, c: right, foreign: wrong };
    expect(resultsBefore(cards, 2, stored)).toEqual({ a: right, b: wrong });
    expect(resultsBefore(cards, 0, stored)).toEqual({});
  });
  it("old bookmarks without results count only newly answered cards", () => {
    const seed = resultsBefore(cards, 2, undefined);
    expect(flashcardResults(cards, 3, seed, [{ index: 2, rating: "good" }])).toEqual({ c: right });
  });
  it("undo drops only the current sitting's answer and retains old failures", () => {
    const history = [{ index: 2, rating: "good" }];
    expect(flashcardResults(cards, 3, { a: wrong, b: right }, history)).toEqual({ a: wrong, b: right, c: right });
    expect(flashcardResults(cards, 2, { a: wrong, b: right }, [])).toEqual({ a: wrong, b: right });
  });
  it("does not persist a still-current card ahead of the resume index", () => {
    expect(flashcardResults(cards, 2, { a: wrong }, [{ index: 2, rating: "good" }])).toEqual({ a: wrong });
  });
  it("a retry round starts without results from its previous card pool", () => {
    expect(flashcardResults([cards[0]!], 0, {}, [])).toEqual({});
  });
});
