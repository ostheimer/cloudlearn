import { describe, expect, it } from "vitest";
import {
  acknowledgeOperations,
  applyReview,
  createNewFsrsCard,
  enqueueOperation,
  evaluateAnswer,
  initialQueueState,
  searchDecks
} from "./index";

describe("domain utilities", () => {
  it("advances fsrs due date after review", () => {
    const card = createNewFsrsCard();
    const now = new Date("2026-02-09T10:00:00.000Z");
    const updated = applyReview(card, "good", now);

    expect(updated.card.due.getTime()).toBeGreaterThan(now.getTime());
  });

  it("keeps offline queue idempotent by operationId", () => {
    const operation = {
      operationId: "op-1",
      operationType: "review",
      createdAt: "2026-02-09T10:00:00.000Z",
      payload: {
        userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
        cardId: "2d0afe28-6be8-46fb-a85a-df88d3db9f5f",
        rating: "good",
        reviewedAt: "2026-02-09T10:00:00.000Z",
        idempotencyKey: "r-1"
      }
    } as const;

    const withOne = enqueueOperation(initialQueueState, operation);
    const withDuplicate = enqueueOperation(withOne, operation);
    const acknowledged = acknowledgeOperations(withDuplicate, ["op-1"]);

    expect(withOne.operations).toHaveLength(1);
    expect(withDuplicate.operations).toHaveLength(1);
    expect(acknowledged.operations).toHaveLength(0);
  });

  it("searches by title and tags while ignoring deleted decks", () => {
    const decks = [
      { id: "1", title: "Biologie", tags: ["schule"] },
      { id: "2", title: "Latein Vokabeln", tags: ["sprachkurs"], deletedAt: "2026-01-01" },
      { id: "3", title: "Cloud", tags: ["tech", "aws"] }
    ];

    expect(searchDecks(decks, "bio")).toHaveLength(1);
    expect(searchDecks(decks, "aws")).toHaveLength(1);
    expect(searchDecks(decks, "latein")).toHaveLength(0);
  });

  it("evaluates multiple learning modes and returns psychometric score", () => {
    const mcq = evaluateAnswer({ mode: "mcq", correctAnswer: "B", userAnswer: "b" });
    const matching = evaluateAnswer({
      mode: "matching",
      correctAnswer: ["alpha", "beta"],
      userAnswer: ["alpha", "beta"]
    });

    expect(mcq.isCorrect).toBe(true);
    expect(mcq.discriminationIndex).toBeGreaterThan(0.5);
    expect(matching.score).toBe(1);
  });
});
