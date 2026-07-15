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
