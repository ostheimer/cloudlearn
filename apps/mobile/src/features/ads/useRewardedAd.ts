import { useState, useCallback } from "react";
import { earnLp } from "../../lib/api";
import { useUsageStore } from "../../store/usageStore";

// LP earned per rewarded ad view
const LP_PER_AD = 5;

export type AdState = "idle" | "loading" | "showing" | "rewarded" | "failed" | "cap_reached";

export interface RewardedAdResult {
  granted: number;
  newBalance: number;
  capReached: boolean;
}

export interface UseRewardedAdReturn {
  state: AdState;
  watchAd: () => Promise<RewardedAdResult | null>;
  reset: () => void;
}

// Simulates an AdMob rewarded ad.
// Replace `simulateAdView` with the real expo-ads-admob / react-native-google-mobile-ads call
// once the SDK is integrated. The LP earn logic is already server-side and tier-gated.
async function simulateAdView(): Promise<boolean> {
  return new Promise((resolve) => {
    // Simulate 1.5s ad viewing time
    setTimeout(() => resolve(true), 1500);
  });
}

export function useRewardedAd(): UseRewardedAdReturn {
  const [state, setState] = useState<AdState>("idle");
  const setUsage = useUsageStore((s) => s.setUsage);

  const watchAd = useCallback(async (): Promise<RewardedAdResult | null> => {
    setState("loading");
    try {
      // Step 1: Show the ad
      setState("showing");
      const adCompleted = await simulateAdView();
      if (!adCompleted) {
        setState("failed");
        return null;
      }

      // Step 2: Grant LP server-side
      const result = await earnLp("ad");

      if (result.capReached) {
        setState("cap_reached");
        return { granted: 0, newBalance: result.newBalance, capReached: true };
      }

      // Step 3: Update local balance
      setUsage({ lpBalance: result.newBalance });
      setState("rewarded");
      return { granted: result.granted, newBalance: result.newBalance, capReached: false };
    } catch {
      setState("failed");
      return null;
    }
  }, [setUsage]);

  const reset = useCallback(() => setState("idle"), []);

  return { state, watchAd, reset };
}

export { LP_PER_AD };
