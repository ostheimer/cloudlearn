import type { ReviewRating } from "./reviewSession";

export interface BufferedReview<Op> {
  cardId: string;
  rating: ReviewRating;
  queuedReview: Op;
}

/**
 * Ratings are buffered, not sent the instant they are tapped (#283). We hold the
 * most recent rating and only release it once the learner has truly moved on
 * (rated the next card, finished, or left the screen). That lets the back arrow
 * discard an unsent rating instead of firing a second, double-counting review.
 *
 * Deliberately pure and network-free: each method returns the review that should
 * be sent *now* (or null), and the caller does the actual sending. This keeps the
 * decision logic — the part that prevents the double count — trivially testable.
 */
export function createReviewSendBuffer<Op>() {
  let pending: BufferedReview<Op> | null = null;

  return {
    /**
     * Rate a card. The previously buffered card is now behind us for good, so it
     * is returned to be sent; this new rating is held back in its place.
     */
    rate(review: BufferedReview<Op>): BufferedReview<Op> | null {
      const previous = pending;
      pending = review;
      return previous;
    },

    /**
     * Correct the rating we are still holding, if it belongs to `cardId`.
     *
     * For the Lückentext "zählt trotzdem" button: a typed answer is graded
     * wrong, the learner overrules that, and the card must end up with a single
     * "good" review. Sending a second one instead leaves the lapse from the
     * first standing — the card counts as failed *and* passed, comes back the
     * next day and keeps a low stability.
     *
     * Returns false when nothing was held for that card (its rating is already
     * on its way to the server); the caller then has to fall back to sending a
     * correcting review, which is the best a client can do after the fact.
     */
    amend(cardId: string, rating: ReviewRating, queuedReview: Op): boolean {
      if (!pending || pending.cardId !== cardId) return false;
      pending = { cardId, rating, queuedReview };
      return true;
    },

    /** Go back: throw away the rating we were holding for the card we return to. */
    back(): void {
      pending = null;
    },

    /**
     * Release whatever is still buffered (session finished / screen left) and
     * clear it, so it is sent exactly once.
     */
    flush(): BufferedReview<Op> | null {
      const current = pending;
      pending = null;
      return current;
    },

    hasPending(): boolean {
      return pending !== null;
    },
  };
}
