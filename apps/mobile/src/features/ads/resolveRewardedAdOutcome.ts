import type { RewardedAdResult } from "./useRewardedAd";

/**
 * How a finished rewarded-ad attempt should be presented. Deriving this in one
 * place stops call sites (the LP store and the "not enough LP" modal) from
 * drifting apart — the exact bug in #285, where the modal hadn't learned about
 * the mock/pending states and so claimed a fake "+0 LP" and zeroed the balance.
 *
 * Only `granted` is a real credit — the caller updates the balance and can close.
 * Every other outcome is informational: show the message, leave the balance alone.
 */
export type RewardedAdOutcome =
  | { kind: "failed"; messageKey: "lp.adFailed" }
  | { kind: "mock"; messageKey: "lp.adMockNotActive" }
  | { kind: "pending"; messageKey: "lp.adRewardPending" }
  | { kind: "capReached"; messageKey: "lp.adCapReached" }
  | { kind: "granted"; messageKey: "lp.adRewarded"; count: number; newBalance: number };

export function resolveRewardedAdOutcome(
  result: RewardedAdResult | null
): RewardedAdOutcome {
  // Order matters and mirrors the LP store: a mock/pending ad reports granted: 0,
  // so those must be caught before the "granted" fall-through — otherwise a
  // no-reward mock reads as a real "+0 LP" credit.
  if (!result) return { kind: "failed", messageKey: "lp.adFailed" };
  if (result.mock) return { kind: "mock", messageKey: "lp.adMockNotActive" };
  if (result.pending) return { kind: "pending", messageKey: "lp.adRewardPending" };
  if (result.capReached) return { kind: "capReached", messageKey: "lp.adCapReached" };
  return {
    kind: "granted",
    messageKey: "lp.adRewarded",
    count: result.granted,
    newBalance: result.newBalance,
  };
}
