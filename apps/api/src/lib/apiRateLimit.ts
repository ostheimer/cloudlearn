import { HttpError } from "./http";
import { checkRateLimit } from "./rateLimit";

/**
 * Limits for authenticated routes whose work can be amplified by large
 * account data. Kept separate per scope so normal progress saves cannot spend
 * the budget of an unrelated library read (#702).
 */
export const API_RATE_LIMITS = {
  sessionProgress: 300,
  dueStats: 60,
  folderStats: 60,
  folderCards: 30,
  trash: 60,
  trashRestore: 60,
  bulkCardOperations: 4000,
} as const;

export async function enforceUserRateLimit(
  userId: string,
  scope: string,
  limitPerMinute: number,
  cost = 1
): Promise<void> {
  if (!(await checkRateLimit(`${scope}:${userId}`, limitPerMinute, 60, cost))) {
    throw new HttpError("Too many requests", 429, "RATE_LIMITED");
  }
}
