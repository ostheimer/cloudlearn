import { useCallback } from "react";

export type AdState =
  | "idle"
  | "loading"
  | "ready"
  | "showing"
  | "rewarded"
  | "failed"
  | "cap_reached";

export interface RewardedAdResult {
  granted: number;
  newBalance: number;
  capReached: boolean;
  // A mock ad was shown; no LP granted (real ads + SSV are not live yet, see #149).
  mock?: boolean;
  // A real ad was shown; LP is credited server-side via AdMob SSV, not inline.
  pending?: boolean;
}

export interface UseRewardedAdReturn {
  state: AdState;
  watchAd: () => Promise<RewardedAdResult | null>;
  reset: () => void;
}

// Web / non-native bundles have no rewarded-ad implementation.
// Keep calls inert instead of pretending to play an ad that grants nothing.
export function useRewardedAd(): UseRewardedAdReturn {
  const watchAd = useCallback(async (): Promise<RewardedAdResult | null> => null, []);
  const reset = useCallback(() => {}, []);
  return { state: "idle", watchAd, reset };
}

export const ADMOB_REWARDED_ID: string | null = null;
