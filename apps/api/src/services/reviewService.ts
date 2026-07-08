import { applyReview, createNewFsrsCard, reconstructFsrsCard } from "@/lib/domain";
import { reviewRequestSchema, type ReviewResponse } from "@/lib/contracts";
import type { CardRecord } from "@/lib/db";
import {
  createReview,
  findReviewByIdempotencyKey,
  getCard,
  updateCardFsrs,
  updateStreakAfterReview,
} from "@/lib/db";

const STATE_NUM_TO_STR: Record<number, "new" | "learning" | "review" | "relearning"> = {
  0: "new",
  1: "learning",
  2: "review",
  3: "relearning",
};

function buildReviewResponse(requestId: string, card: CardRecord): ReviewResponse {
  return {
    requestId,
    cardId: card.id,
    nextDueAt: card.fsrsDue,
    stability: card.fsrsStability,
    difficulty: card.fsrsDifficulty,
    state: card.fsrsState,
  };
}

export async function storeReview(
  input: unknown,
  requestId: string
): Promise<ReviewResponse> {
  const parsed = reviewRequestSchema.parse(input);
  const existing = await findReviewByIdempotencyKey(
    parsed.userId,
    parsed.idempotencyKey
  );
  const card = await getCard(parsed.cardId, parsed.userId);

  if (!card) {
    throw new Error("Card not found");
  }

  if (existing) {
    return buildReviewResponse(requestId, card);
  }

  const reviewInput: {
    userId: string;
    cardId: string;
    rating: "again" | "hard" | "good" | "easy";
    reviewedAt: string;
    idempotencyKey: string;
    reviewDurationMs?: number;
  } = {
    userId: parsed.userId,
    cardId: parsed.cardId,
    rating: parsed.rating,
    reviewedAt: parsed.reviewedAt,
    idempotencyKey: parsed.idempotencyKey,
  };

  if (parsed.reviewDurationMs !== undefined) {
    reviewInput.reviewDurationMs = parsed.reviewDurationMs;
  }

  await createReview(reviewInput);

  // Update streak (fire-and-forget for first review of the day)
  updateStreakAfterReview(parsed.userId).catch(() => {});

  // Reconstruct the FSRS card from persisted DB state (NOT a blank new card!)
  // This ensures the algorithm considers previous reviews for scheduling.
  const isNewCard =
    card.fsrsState === "new" &&
    card.fsrsReps === 0 &&
    card.fsrsStability === 0;

  const fsrsCard = isNewCard
    ? createNewFsrsCard()
    : reconstructFsrsCard({
        fsrsDue: card.fsrsDue,
        fsrsStability: card.fsrsStability,
        fsrsDifficulty: card.fsrsDifficulty,
        fsrsState: card.fsrsState,
        fsrsReps: card.fsrsReps,
        fsrsLapses: card.fsrsLapses,
        fsrsElapsedDays: card.fsrsElapsedDays,
        fsrsScheduledDays: card.fsrsScheduledDays,
        fsrsLearningSteps: card.fsrsLearningSteps,
        fsrsLastReview: card.fsrsLastReview,
      });

  const next = applyReview(fsrsCard, parsed.rating, new Date(parsed.reviewedAt));

  const updatedCard = await updateCardFsrs(
    parsed.cardId,
    parsed.userId,
    {
      fsrsDue: next.card.due.toISOString(),
      fsrsStability: next.card.stability,
      fsrsDifficulty: next.card.difficulty,
      fsrsState: STATE_NUM_TO_STR[next.card.state] ?? "review",
      fsrsReps: next.card.reps,
      fsrsLapses: next.card.lapses,
      fsrsElapsedDays: next.card.elapsed_days,
      fsrsScheduledDays: next.card.scheduled_days,
      fsrsLearningSteps: next.card.learning_steps,
      fsrsLastReview: next.card.last_review?.toISOString() ?? null,
    }
  );

  if (!updatedCard) {
    throw new Error("Card update failed");
  }

  return buildReviewResponse(requestId, updatedCard);
}
