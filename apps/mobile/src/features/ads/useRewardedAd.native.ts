import { useState, useCallback, useRef } from "react";
import { Alert, Linking, Platform } from "react-native";
import { earnLp } from "../../lib/api";
import { i18n } from "../../i18n";
import { useUsageStore } from "../../store/usageStore";
import {
  useTrackingConsentStore,
} from "./trackingConsent";
import { shouldPromptForAdPersonalization } from "./trackingConsentUtils";

// LP earned per rewarded ad view
const LP_PER_AD = 5;

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
}

export interface UseRewardedAdReturn {
  state: AdState;
  watchAd: () => Promise<RewardedAdResult | null>;
  reset: () => void;
}

// Loads and shows a real rewarded ad via react-native-google-mobile-ads.
// Falls back to a short simulation if the native SDK is unavailable.
async function loadAndShowRewardedAd(options?: {
  personalizedAds?: boolean;
}): Promise<boolean> {
  try {
    const { RewardedAd, RewardedAdEventType } =
      await import("react-native-google-mobile-ads");

    if (!ADMOB_REWARDED_ID) {
      return false;
    }

    return await new Promise<boolean>((resolve) => {
      const ad = RewardedAd.createForAdRequest(ADMOB_REWARDED_ID, {
        requestNonPersonalizedAdsOnly: !options?.personalizedAds,
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
  const setUsage = useUsageStore((s) => s.setUsage);
  const activeRef = useRef(false);

  const watchAd = useCallback(async (): Promise<RewardedAdResult | null> => {
    if (activeRef.current) return null;
    activeRef.current = true;
    try {
      const personalizedAds = await resolveAdPersonalizationPreference();
      if (personalizedAds === null) {
        setState("idle");
        activeRef.current = false;
        return null;
      }

      setState("loading");
      setState("showing");
      const rewarded = await loadAndShowRewardedAd({ personalizedAds });

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
