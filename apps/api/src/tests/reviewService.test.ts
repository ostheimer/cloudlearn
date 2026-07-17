import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CardRecord } from "@/lib/db";

const dbMocks = vi.hoisted(() => ({
  findReviewByIdempotencyKey: vi.fn(),
  getCard: vi.fn(),
  createReview: vi.fn(),
  updateCardFsrs: vi.fn(),
  updateStreakAfterReview: vi.fn(),
  markFriendStreakDay: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  findReviewByIdempotencyKey: dbMocks.findReviewByIdempotencyKey,
  getCard: dbMocks.getCard,
  createReview: dbMocks.createReview,
  updateCardFsrs: dbMocks.updateCardFsrs,
  updateStreakAfterReview: dbMocks.updateStreakAfterReview,
  markFriendStreakDay: dbMocks.markFriendStreakDay,
}));

import { storeReview } from "@/services/reviewService";

const userId = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";
const attackerId = "11111111-1111-4111-8111-111111111111";
const cardId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const baseCard: CardRecord = {
  id: cardId,
  userId,
  deckId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  front: "Q",
  back: "A",
  type: "basic",
  difficulty: "medium",
  tags: [],
  starred: false,
  fsrsDue: "2026-07-07T10:00:00.000Z",
  fsrsStability: 1,
  fsrsDifficulty: 5,
  fsrsState: "review",
  fsrsReps: 2,
  fsrsLapses: 0,
  fsrsElapsedDays: 1,
  fsrsScheduledDays: 1,
  fsrsLearningSteps: 0,
  fsrsLastReview: "2026-07-06T10:00:00.000Z",
};

describe("storeReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.updateStreakAfterReview.mockResolvedValue(undefined);
    dbMocks.markFriendStreakDay.mockResolvedValue(undefined);
  });

  it("rejects reviews for cards owned by another user", async () => {
    dbMocks.findReviewByIdempotencyKey.mockResolvedValue(null);
    dbMocks.getCard.mockResolvedValue(null);

    await expect(
      storeReview(
        {
          userId: attackerId,
          cardId,
          rating: "good",
          reviewedAt: "2026-07-07T12:00:00.000Z",
          idempotencyKey: "review-idor-1",
        },
        "req-idor-1"
      )
    ).rejects.toThrow("Card not found");

    expect(dbMocks.getCard).toHaveBeenCalledWith(cardId, attackerId);
    expect(dbMocks.createReview).not.toHaveBeenCalled();
    expect(dbMocks.updateCardFsrs).not.toHaveBeenCalled();
  });

  it("does not re-apply FSRS when the idempotency key already exists", async () => {
    dbMocks.findReviewByIdempotencyKey.mockResolvedValue({
      id: "review-1",
      userId,
      cardId,
      rating: "good",
      reviewedAt: "2026-07-07T12:00:00.000Z",
      idempotencyKey: "review-retry-1",
    });
    dbMocks.getCard.mockResolvedValue(baseCard);

    const result = await storeReview(
      {
        userId,
        cardId,
        rating: "good",
        reviewedAt: "2026-07-07T12:00:00.000Z",
        idempotencyKey: "review-retry-1",
      },
      "req-retry-1"
    );

    expect(result).toEqual({
      requestId: "req-retry-1",
      cardId,
      nextDueAt: baseCard.fsrsDue,
      stability: baseCard.fsrsStability,
      difficulty: baseCard.fsrsDifficulty,
      state: baseCard.fsrsState,
    });
    expect(dbMocks.createReview).not.toHaveBeenCalled();
    expect(dbMocks.updateCardFsrs).not.toHaveBeenCalled();
  });

  it("scopes FSRS updates to the authenticated owner", async () => {
    dbMocks.findReviewByIdempotencyKey.mockResolvedValue(null);
    dbMocks.getCard.mockResolvedValue({
      ...baseCard,
      fsrsState: "new",
      fsrsReps: 0,
      fsrsStability: 0,
    });
    dbMocks.createReview.mockResolvedValue({
      id: "review-2",
      userId,
      cardId,
      rating: "good",
      reviewedAt: "2026-07-07T12:00:00.000Z",
      idempotencyKey: "review-owner-1",
    });
    dbMocks.updateCardFsrs.mockResolvedValue({
      ...baseCard,
      fsrsState: "learning",
      fsrsDue: "2026-07-08T12:00:00.000Z",
    });

    await storeReview(
      {
        userId,
        cardId,
        rating: "good",
        reviewedAt: "2026-07-07T12:00:00.000Z",
        idempotencyKey: "review-owner-1",
      },
      "req-owner-1"
    );

    expect(dbMocks.updateCardFsrs).toHaveBeenCalledWith(
      cardId,
      userId,
      expect.objectContaining({
        fsrsState: expect.any(String),
        fsrsDue: expect.any(String),
      })
    );
  });

  it("clamps a reviewedAt from the future — in the log AND in the FSRS schedule", async () => {
    dbMocks.findReviewByIdempotencyKey.mockResolvedValue(null);
    dbMocks.getCard.mockResolvedValue(baseCard);
    const now = new Date("2026-07-17T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    await storeReview(
      {
        userId,
        cardId,
        rating: "good",
        reviewedAt: "2027-07-17T12:00:00.000Z", // ein Jahr voraus
        idempotencyKey: "review-future-1",
      },
      "req-future-1"
    );

    // Der Eintrag trägt die geklemmte Zeit, nicht die behauptete.
    expect(dbMocks.createReview).toHaveBeenCalledWith(
      expect.objectContaining({ reviewedAt: now.toISOString() })
    );
    // Und die Planung rechnet mit derselben Zeit — sonst stünde in der
    // Datenbank ein anderer Zeitpunkt als der, auf dem der Plan beruht.
    const scheduled = dbMocks.updateCardFsrs.mock.calls[0]?.[2] as { fsrsDue: string };
    expect(new Date(scheduled.fsrsDue).getTime()).toBeLessThan(
      new Date("2027-01-01T00:00:00.000Z").getTime()
    );
    vi.useRealTimers();
  });

  it("leaves an offline reviewedAt from the past untouched", async () => {
    dbMocks.findReviewByIdempotencyKey.mockResolvedValue(null);
    dbMocks.getCard.mockResolvedValue(baseCard);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));
    const offline = "2026-07-16T09:30:00.000Z"; // gestern im Zug gelernt

    await storeReview(
      { userId, cardId, rating: "good", reviewedAt: offline, idempotencyKey: "review-offline-1" },
      "req-offline-1"
    );

    expect(dbMocks.createReview).toHaveBeenCalledWith(
      expect.objectContaining({ reviewedAt: offline })
    );
    vi.useRealTimers();
  });

  it("tolerates a clock that runs a few minutes fast", async () => {
    dbMocks.findReviewByIdempotencyKey.mockResolvedValue(null);
    dbMocks.getCard.mockResolvedValue(baseCard);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));
    const slightlyAhead = "2026-07-17T12:03:00.000Z"; // 3 Minuten vor

    await storeReview(
      { userId, cardId, rating: "good", reviewedAt: slightlyAhead, idempotencyKey: "review-skew-1" },
      "req-skew-1"
    );

    expect(dbMocks.createReview).toHaveBeenCalledWith(
      expect.objectContaining({ reviewedAt: slightlyAhead })
    );
    vi.useRealTimers();
  });
});
