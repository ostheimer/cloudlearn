import { useState, useCallback, useRef } from "react";
import { Alert, Linking, Platform } from "react-native";
import { i18n } from "../../i18n";
import { useSessionStore } from "../../store/sessionStore";
import {
  useTrackingConsentStore,
} from "./trackingConsent";
import { shouldPromptForAdPersonalization } from "./trackingConsentUtils";
import { REAL_ADS_ENABLED } from "./adsMode";
import { createAdRewardSettler } from "./adRewardSettler";

// How long to wait for a rewarded ad to LOAD before giving up. Only guards the
// load phase — once the ad is showing, CLOSED/EARNED_REWARD settle it, so a
// slow watcher is never cut off (#206 Teil B).
const AD_LOAD_TIMEOUT_MS = 15000;

const APP_VARIANT = process.env.EXPO_PUBLIC_APP_VARIANT ?? "development";
const USE_TEST_ADS = __DEV__ || APP_VARIANT !== "production";
const GOOGLE_ADMOB_TEST_REWARDED_IDS = {
  ios: "ca-app-pub-3940256099942544/1712485313",
  android: "ca-app-pub-3940256099942544/5224354917",
};

// AdMob unit IDs — test IDs are safe for dev/preview, but production must be
// configured explicitly so a release cannot silently ship with Google test ads.
const ADMOB_REWARDED_ID = Platform.select({
  ios: USE_TEST_ADS
    ? GOOGLE_ADMOB_TEST_REWARDED_IDS.ios
    : (process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID?.trim() ?? null),
  android: USE_TEST_ADS
    ? GOOGLE_ADMOB_TEST_REWARDED_IDS.android
    : (process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID?.trim() ?? null),
  default: USE_TEST_ADS ? GOOGLE_ADMOB_TEST_REWARDED_IDS.android : null,
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

// Loads and shows a real rewarded ad via react-native-google-mobile-ads.
// Falls back to a short simulation if the native SDK is unavailable.
async function loadAndShowRewardedAd(options: {
  personalizedAds?: boolean;
  userId: string;
}): Promise<boolean> {
  try {
    const { RewardedAd, RewardedAdEventType, AdEventType } =
      await import("react-native-google-mobile-ads");

    if (!ADMOB_REWARDED_ID) {
      return false;
    }

    return await new Promise<boolean>((resolve) => {
      // Server-Side Verification: tell AdMob which user this reward belongs to (via
      // the request options), so Google signs the callback and hits our SSV endpoint,
      // which credits the LP. No client-side grant — the server hands out LP.
      const ad = RewardedAd.createForAdRequest(ADMOB_REWARDED_ID, {
        requestNonPersonalizedAdsOnly: !options.personalizedAds,
        serverSideVerificationOptions: { userId: options.userId },
      });

      const unsubs: Array<() => void> = [];
      let loadTimer: ReturnType<typeof setTimeout> | null = null;

      // Exactly one outcome, then tear everything down — no listener or timer can
      // resolve the promise twice, and nothing is left dangling (#206 Teil B).
      const settle = createAdRewardSettler((rewarded) => {
        for (const unsub of unsubs) unsub();
        if (loadTimer) {
          clearTimeout(loadTimer);
          loadTimer = null;
        }
        resolve(rewarded);
      });

      loadTimer = setTimeout(() => settle("timeout"), AD_LOAD_TIMEOUT_MS);

      unsubs.push(
        ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
          // Loaded in time — stop the load timeout and show. From here the ad is
          // on screen, so CLOSED (or EARNED_REWARD) is guaranteed to settle it.
          if (loadTimer) {
            clearTimeout(loadTimer);
            loadTimer = null;
          }
          ad.show();
        }),
      );
      unsubs.push(
        ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => settle("earned")),
      );
      // The fix: dismissing the ad before earning now settles the promise instead
      // of hanging forever.
      unsubs.push(ad.addAdEventListener(AdEventType.CLOSED, () => settle("closed")));
      unsubs.push(ad.addAdEventListener(AdEventType.ERROR, () => settle("error")));

      ad.load();
    });
  } catch {
    // SDK unavailable → no ad was shown, so report failure (never a fake success).
    return false;
  }
}

type TrackingPromptChoice = "personalized" | "non_personalized" | "cancel";

async function promptForAdPersonalization(): Promise<TrackingPromptChoice> {
  return await new Promise<TrackingPromptChoice>((resolve) => {
    let settled = false;
    const settle = (choice: TrackingPromptChoice) => {
      if (settled) return;
      settled = true;
      resolve(choice);
    };

    Alert.alert(
      i18n.t("tracking.prePromptTitle"),
      i18n.t("tracking.prePromptBody"),
      [
        {
          text: i18n.t("common.cancel"),
          style: "cancel",
          onPress: () => settle("cancel"),
        },
        {
          text: i18n.t("tracking.prePromptContinueWithout"),
          onPress: () => settle("non_personalized"),
        },
        {
          text: i18n.t("tracking.prePromptAllow"),
          onPress: () => settle("personalized"),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => settle("cancel"),
      }
    );
  });
}

async function promptForSystemSettings(): Promise<void> {
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    Alert.alert(
      i18n.t("tracking.permissionBlockedTitle"),
      i18n.t("tracking.permissionBlockedBody"),
      [
        {
          text: i18n.t("common.cancel"),
          style: "cancel",
          onPress: finish,
        },
        {
          text: i18n.t("tracking.openSettings"),
          onPress: () => {
            void Linking.openSettings().finally(finish);
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: finish,
      }
    );
  });
}

async function resolveAdPersonalizationPreference(): Promise<boolean | null> {
  const consentStore = useTrackingConsentStore.getState();
  if (!consentStore.hydrated) {
    await consentStore.initialize();
  }

  await useTrackingConsentStore.getState().refreshPermissionStatus();

  const current = useTrackingConsentStore.getState();
  if (
    shouldPromptForAdPersonalization(
      current.preference,
      current.autoPromptCompleted
    )
  ) {
    const choice = await promptForAdPersonalization();
    if (choice === "cancel") {
      return null;
    }

    if (choice === "non_personalized") {
      await useTrackingConsentStore
        .getState()
        .chooseNonPersonalizedAds({ markPromptCompleted: true });
      return false;
    }

    const permission = await useTrackingConsentStore
      .getState()
      .allowPersonalizedAds({ markPromptCompleted: true });

    if (
      !permission.granted &&
      Platform.OS === "ios" &&
      permission.permissionStatus === "denied" &&
      !permission.canAskAgain
    ) {
      await promptForSystemSettings();
    }

    return useTrackingConsentStore.getState().isPersonalizedAdsEnabled();
  }

  return current.isPersonalizedAdsEnabled();
}

export function useRewardedAd(): UseRewardedAdReturn {
  const [state, setState] = useState<AdState>("idle");
  const userId = useSessionStore((s) => s.userId);
  const activeRef = useRef(false);

  const watchAd = useCallback(async (): Promise<RewardedAdResult | null> => {
    if (activeRef.current) return null;
    activeRef.current = true;
    try {
      // Real ads (Google-served + SSV) are not live yet → show a mock ad that grants
      // no LP. This keeps the closed "self-grant LP for a fake ad" hole closed. Once
      // REAL_ADS_ENABLED flips on, the real path below credits LP via AdMob SSV.
      if (!REAL_ADS_ENABLED || !userId) {
        setState("showing");
        await new Promise<void>((resolve) => setTimeout(resolve, 1200));
        setState("idle");
        activeRef.current = false;
        return { granted: 0, newBalance: 0, capReached: false, mock: true };
      }

      const personalizedAds = await resolveAdPersonalizationPreference();
      if (personalizedAds === null) {
        setState("idle");
        activeRef.current = false;
        return null;
      }

      setState("loading");
      setState("showing");
      const rewarded = await loadAndShowRewardedAd({ personalizedAds, userId });

      if (!rewarded) {
        setState("failed");
        activeRef.current = false;
        return null;
      }

      // The ad completed. LP is NOT granted here — AdMob's SSV callback credits it
      // server-side (Google → /api/v1/ads/ssv); the screen refreshes the balance.
      setState("rewarded");
      activeRef.current = false;
      return { granted: 0, newBalance: 0, capReached: false, pending: true };
    } catch {
      setState("failed");
      activeRef.current = false;
      return null;
    }
  }, [userId]);

  const reset = useCallback(() => {
    activeRef.current = false;
    setState("idle");
  }, []);

  return { state, watchAd, reset };
}

export { ADMOB_REWARDED_ID };
