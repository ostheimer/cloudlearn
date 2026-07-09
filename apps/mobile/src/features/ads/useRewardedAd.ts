import { useState, useCallback, useRef } from "react";

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

// Web / non-native bundles never show real ads — always a short mock simulation.
async function showMockAd(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 1200));
}

export function useRewardedAd(): UseRewardedAdReturn {
  const [state, setState] = useState<AdState>("idle");
  const activeRef = useRef(false);

  const watchAd = useCallback(async (): Promise<RewardedAdResult | null> => {
    if (activeRef.current) return null;
    activeRef.current = true;
    setState("showing");
    try {
      await showMockAd();
      setState("idle");
      activeRef.current = false;
      // Mock ad → no LP. We deliberately do NOT call the server: rewarded-ad LP is
      // only granted via AdMob SSV once real ads are enabled (#149).
      return { granted: 0, newBalance: 0, capReached: false, mock: true };
    } catch {
      setState("failed");
      activeRef.current = false;
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    activeRef.current = false;
    setState("idle");
  }, []);

  return { state, watchAd, reset };
}

export const ADMOB_REWARDED_ID: string | null = null;
