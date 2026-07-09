/** Minimum reviewed cards before the server may grant session LP. */
export const LP_SESSION_MIN_CARDS = 5;

export interface SessionEarnResult {
  granted: number;
  capReached: boolean;
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
