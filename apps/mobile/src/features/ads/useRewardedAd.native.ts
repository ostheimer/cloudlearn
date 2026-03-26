import { useState, useCallback, useRef } from "react";
import { Platform } from "react-native";
import { earnLp } from "../../lib/api";
import { useUsageStore } from "../../store/usageStore";

// LP earned per rewarded ad view
const LP_PER_AD = 5;

// AdMob unit IDs — use test IDs in development, real IDs from env in production.
// Test IDs are officially provided by Google and safe for all dev environments.
const ADMOB_REWARDED_ID = Platform.select({
  ios:
    process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID ??
    "ca-app-pub-3940256099942544/1712485313",
  android:
    process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID ??
    "ca-app-pub-3940256099942544/5224354917",
  default: "ca-app-pub-3940256099942544/5224354917",
});

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
}

export interface UseRewardedAdReturn {
  state: AdState;
  watchAd: () => Promise<RewardedAdResult | null>;
  reset: () => void;
}

// Loads and shows a real rewarded ad via react-native-google-mobile-ads.
// Falls back to a short simulation if the native SDK is unavailable.
async function loadAndShowRewardedAd(): Promise<boolean> {
  try {
    const { RewardedAd, RewardedAdEventType, TestIds } =
      await import("react-native-google-mobile-ads");

    const adUnitId = __DEV__
      ? TestIds.REWARDED
      : (ADMOB_REWARDED_ID ?? TestIds.REWARDED);

    return await new Promise<boolean>((resolve) => {
      const ad = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      const unsubscribeLoaded = ad.addAdEventListener(
        RewardedAdEventType.LOADED,
        () => {
          unsubscribeLoaded();
          ad.show();
        }
      );

      const unsubscribeEarned = ad.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        () => {
          unsubscribeEarned();
          resolve(true);
        }
      );

      ad.addAdEventListener(
        "error" as Parameters<typeof ad.addAdEventListener>[0],
        () => {
          resolve(false);
        }
      );

      ad.load();
    });
  } catch {
    return new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(true), 1500);
    });
  }
}

export function useRewardedAd(): UseRewardedAdReturn {
  const [state, setState] = useState<AdState>("idle");
  const setUsage = useUsageStore((s) => s.setUsage);
  const activeRef = useRef(false);

  const watchAd = useCallback(async (): Promise<RewardedAdResult | null> => {
    if (activeRef.current) return null;
    activeRef.current = true;
    setState("loading");
    try {
      setState("showing");
      const rewarded = await loadAndShowRewardedAd();

      if (!rewarded) {
        setState("failed");
        activeRef.current = false;
        return null;
      }

      const result = await earnLp("ad");

      if (result.capReached) {
        setState("cap_reached");
        activeRef.current = false;
        return { granted: 0, newBalance: result.newBalance, capReached: true };
      }

      setUsage({ lpBalance: result.newBalance });
      setState("rewarded");
      activeRef.current = false;
      return {
        granted: result.granted,
        newBalance: result.newBalance,
        capReached: false,
      };
    } catch {
      setState("failed");
      activeRef.current = false;
      return null;
    }
  }, [setUsage]);

  const reset = useCallback(() => {
    activeRef.current = false;
    setState("idle");
  }, []);

  return { state, watchAd, reset };
}

export { LP_PER_AD, ADMOB_REWARDED_ID };
