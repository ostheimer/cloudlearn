import { describe, expect, it } from "vitest";
import { createReviewSendBuffer, type BufferedReview } from "./reviewSendBuffer";

// A tiny driver that uses the buffer exactly the way learn.tsx does: rating a
// card releases the previous one to be "sent", going back discards the unsent
// one, and flushing releases whatever is left. `sent` records what actually
// reached the server, as "cardId:rating".
function makeDriver() {
  const buffer = createReviewSendBuffer<null>();
  const sent: string[] = [];
  const record = (r: BufferedReview<null> | null) => {
    if (r) sent.push(`${r.cardId}:${r.rating}`);
  };
  return {
    sent,
    rate(cardId: string, rating: BufferedReview<null>["rating"]) {
      record(buffer.rate({ cardId, rating, queuedReview: null }));
    },
    back() {
      buffer.back();
    },
    flush() {
      record(buffer.flush());
    },
    hasPending: () => buffer.hasPending(),
  };
}

describe("review send buffer (#283)", () => {
  it("holds a rating back until the learner moves on", () => {
    const d = makeDriver();
    d.rate("a", "good");
    // Nothing sent yet — the rating is buffered, not fired on tap.
    expect(d.sent).toEqual([]);
    expect(d.hasPending()).toBe(true);
  });

  it("releases the previous card's rating when the next card is rated", () => {
    const d = makeDriver();
    d.rate("a", "good");
    d.rate("b", "easy");
    expect(d.sent).toEqual(["a:good"]);
  });

  it("sends every rating exactly once across a full session", () => {
    const d = makeDriver();
    d.rate("a", "good");
    d.rate("b", "hard");
    d.rate("c", "again");
    d.flush(); // session finished / screen left
    expect(d.sent).toEqual(["a:good", "b:hard", "c:again"]);
  });

  it("discards the unsent rating on back, so re-rating does NOT double count", () => {
    const d = makeDriver();
    // Accidental tap, then back, then the correction.
    d.rate("a", "good");
    d.back();
    d.rate("a", "again");
    d.flush();
    // Only the corrected rating was ever sent — the accidental "good" never left.
    expect(d.sent).toEqual(["a:again"]);
  });

  it("back only discards the most recent rating; earlier ones stay committed", () => {
    const d = makeDriver();
    d.rate("a", "good"); // buffered
    d.rate("b", "good"); // releases a:good, buffers b
    d.back(); // discards the unsent b
    d.rate("b", "again"); // correction for b
    d.flush();
    expect(d.sent).toEqual(["a:good", "b:again"]);
  });

  it("flushing an empty buffer sends nothing", () => {
    const d = makeDriver();
    d.flush();
    expect(d.sent).toEqual([]);
  });

  it("back with nothing buffered is a no-op", () => {
    const d = makeDriver();
    d.back();
    d.flush();
    expect(d.sent).toEqual([]);
    expect(d.hasPending()).toBe(false);
  });

  it("repeated back-and-forth on one card sends only the final rating once", () => {
    const d = makeDriver();
    d.rate("a", "good");
    d.back();
    d.rate("a", "hard");
    d.back();
    d.rate("a", "easy");
    d.flush();
    expect(d.sent).toEqual(["a:easy"]);
  });
});
