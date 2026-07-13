import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Bug #210: the Multiple-Choice quiz must not let lucky guesses advance the FSRS
// scheduler. Product decision: count ONLY wrong answers — a wrong answer submits
// an "again" review (card resurfaces sooner); a correct answer must NOT touch FSRS
// at all. These assertions scan the page source, the same seam the repo already
// uses for this page in learn-session-lp-pages.test.ts (there is no jsdom/render
// test setup in this package, so component interaction can't be exercised here).

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const quizPage = readFileSync(
  join(webRoot, "app/dashboard/deck/[id]/quiz/page.tsx"),
  "utf-8",
);

describe("quiz page FSRS review gating (#210)", () => {
  it("submits an 'again' review for wrong answers", () => {
    expect(quizPage).toContain('reviewCard(userId, q.cardId, "again")');
  });

  it("does not write FSRS on a correct answer (resolved promise instead)", () => {
    expect(quizPage).toContain("Promise.resolve()");
  });

  it("never submits a 'good' rating from the quiz any more", () => {
    // The old buggy line wrote FSRS on every answer via a good/again ternary.
    expect(quizPage).not.toContain('correct ? "good" : "again"');
    expect(quizPage).not.toContain('"good"');
  });

  it("still queues the review promise so session LP earning is unchanged", () => {
    // pendingReviewsRef.current.length feeds getSessionReviewedCount → earnLp.
    expect(quizPage).toContain("pendingReviewsRef.current.push(reviewPromise)");
  });
});
