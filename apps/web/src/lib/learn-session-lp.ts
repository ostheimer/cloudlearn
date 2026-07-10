/** Minimum reviewed cards before the server may grant session LP. */
export const LP_SESSION_MIN_CARDS = 5;

export interface SessionEarnResult {
  granted: number;
  capReached: boolean;
}

export interface SessionAwardState {
  finalized: boolean;
  inFlight: Promise<void> | null;
}

/** Includes a review submitted before the page's delayed index transition. */
export function getSessionReviewedCount(
  completedIndex: number,
  pendingReviewCount: number,
): number {
  return Math.max(completedIndex, pendingReviewCount);
}

/** Starts one award attempt and lets concurrent callers await the same work. */
export function beginSessionAward(
  state: SessionAwardState,
  reviewedCount: number,
  run: () => Promise<void>,
): Promise<void> {
  if (state.inFlight) {
    return state.inFlight;
  }
  if (state.finalized || reviewedCount < LP_SESSION_MIN_CARDS) {
    return Promise.resolve();
  }

  const inFlight = run().finally(() => {
    if (state.inFlight === inFlight) {
      state.inFlight = null;
    }
  });
  state.inFlight = inFlight;
  return inFlight;
}

/**
 * Returns true when no further earnLp retry is needed for the current session.
 * A zero grant without cap means reviews may not have landed server-side yet.
 */
export function isSessionEarnFinalized(
  result: SessionEarnResult,
  reviewedCount: number,
): boolean {
  if (reviewedCount < LP_SESSION_MIN_CARDS) {
    return false;
  }

  return result.granted > 0 || result.capReached;
}
