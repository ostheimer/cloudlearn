import { applyReview, createNewFsrsCard } from "@/lib/domain";
import { reviewRequestSchema, type ReviewResponse } from "@/lib/contracts";
import {
  createReview,
  findReviewByIdempotencyKey,
  getCard,
  updateCardFsrs,
  updateStreakAfterReview,
} from "@/lib/db";

export async function storeReview(
  input: unknown,
  requestId: string
): Promise<ReviewResponse> {
  const parsed = reviewRequestSchema.parse(input);
  const existing = await findReviewByIdempotencyKey(
    parsed.userId,
    parsed.idempotencyKey
  );
  const card = await getCard(parsed.cardId);

  if (!card) {
    throw new Error("Card not found");
  }

  if (!existing) {
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
  }

  const fsrsCard = createNewFsrsCard();
  const next = applyReview(fsrsCard, parsed.rating, new Date(parsed.reviewedAt));

  const normalizedStateMap: Record<
    number,
    "new" | "learning" | "review" | "relearning"
  > = {
    0: "new",
    1: "learning",
    2: "review",
    3: "relearning",
  };

  const updatedCard = await updateCardFsrs(parsed.cardId, {
    fsrsDue: next.card.due.toISOString(),
    fsrsStability: next.card.stability,
    fsrsDifficulty: next.card.difficulty,
    fsrsState: normalizedStateMap[next.card.state] ?? "review",
  });

  if (!updatedCard) {
    throw new Error("Card update failed");
  }

  return {
    requestId,
    cardId: parsed.cardId,
    nextDueAt: updatedCard.fsrsDue,
    stability: updatedCard.fsrsStability,
    difficulty: updatedCard.fsrsDifficulty,
    state: updatedCard.fsrsState,
  };
}
