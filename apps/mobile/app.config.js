// Dynamic Expo config — allows AdMob IDs and other values to be set
// via environment variables for different build environments.
// EAS Build injects EXPO_PUBLIC_* variables from eas.json "env" or Vercel/EAS secrets.

const APP_VARIANT =
  process.env.APP_VARIANT ?? process.env.EXPO_PUBLIC_APP_VARIANT ?? "development";
const IS_DEV = APP_VARIANT === "development";
const IS_PREVIEW = APP_VARIANT === "preview";
const IS_PRODUCTION = APP_VARIANT === "production";

const GOOGLE_ADMOB_TEST_APP_IDS = {
  ios: "ca-app-pub-3940256099942544~1458002511",
  android: "ca-app-pub-3940256099942544~3347511713",
};
// Expo loads this configuration as CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { realAdsEnabled: REAL_ADS_ENABLED } = require("./ads-mode.json");
const INCLUDE_MOBILE_ADS_SDK = !IS_PRODUCTION || REAL_ADS_ENABLED;
const INCLUDE_TRACKING_PERMISSION = !IS_PRODUCTION || REAL_ADS_ENABLED;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { releasePlatforms, productionVariables, validProductionValue } = require("./scripts/release-platform.cjs");
const platforms = releasePlatforms();

if (IS_PRODUCTION) {
  for (const platform of platforms) {
    for (const { name, pattern } of productionVariables(platform)) {
      const value = process.env[name]?.trim();
      if (!value) {
        throw new Error(`${name} is required for production builds. Set it in EAS before submitting clearn.`);
      }
      if (!validProductionValue(value, pattern)) {
        throw new Error(`${name} is invalid for production builds. Set a valid production value in EAS before submitting clearn.`);
      }
    }
  }
}

const ADMOB_IOS_APP_ID = INCLUDE_MOBILE_ADS_SDK
  ? IS_PRODUCTION
    ? (platforms.includes("ios") ? process.env.EXPO_PUBLIC_ADMOB_APP_IOS_ID?.trim() : undefined)
    : GOOGLE_ADMOB_TEST_APP_IDS.ios
  : undefined;
const ADMOB_ANDROID_APP_ID = INCLUDE_MOBILE_ADS_SDK
  ? IS_PRODUCTION
    ? (platforms.includes("android") ? process.env.EXPO_PUBLIC_ADMOB_APP_ANDROID_ID?.trim() : undefined)
    : GOOGLE_ADMOB_TEST_APP_IDS.android
  : undefined;

const FACE_ID_PERMISSION =
  "clearn verwendet Face ID, um deine eingeloggte App lokal zu entsperren.";

// Absturzmeldung bleibt komplett aus, solange kein DSN gesetzt ist — dann
// bekommt der native Build auch keinen Sentry-Plugin-Eintrag (kein
// zusätzlicher nativer Code ohne bewusstes Opt-in). Siehe src/lib/crashReporting.ts.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

/** @type {import('@expo/config').ExpoConfig} */
module.exports = ({ config }) => {
  const runtimeVersion = IS_PREVIEW
    ? { policy: "fingerprint" }
    : config.runtimeVersion ?? { policy: "appVersion" };

  const baseInfoPlist = { ...config.ios?.infoPlist };
  delete baseInfoPlist.GADApplicationIdentifier;
  if (!INCLUDE_TRACKING_PERMISSION) {
    delete baseInfoPlist.NSUserTrackingUsageDescription;
  }

  const result = {
    ...config,
    name: IS_DEV ? "clearn (Dev)" : IS_PREVIEW ? "clearn (Preview)" : "clearn",
    slug: "clearn",
    runtimeVersion,
    updates: {
      ...config.updates,
      // Preview builds should always boot their embedded bundle first, otherwise
      // a stale OTA update can crash a newer native binary during startup.
      //
      // Do NOT flip this on together with expo-updates without solving the
      // fingerprint problem first: build b5263d5e (16.07.) died in the
      // "Configure expo-updates" phase because the fingerprint runtimeVersion
      // resolves differently on this pnpm monorepo locally vs. on EAS
      // (expoConfigPlugins pulls in @babel/* files from the pnpm store), so EAS
      // refused the build — updates published here could never match it.
      enabled: IS_PREVIEW ? false : config.updates?.enabled ?? true,
    },
    ios: {
      ...config.ios,
      infoPlist: {
        ...baseInfoPlist,
        ...(INCLUDE_MOBILE_ADS_SDK
          ? { GADApplicationIdentifier: ADMOB_IOS_APP_ID }
          : {}),
        NSFaceIDUsageDescription: FACE_ID_PERMISSION,
      },
    },
    android: {
      ...config.android,
    },
    plugins: [
      ...(config.plugins ?? []).filter(
        (p) =>
          // Remove the static react-native-google-mobile-ads entry — we provide it below
          !(Array.isArray(p) && p[0] === "react-native-google-mobile-ads") &&
          // A disabled production release must not advertise an ATT prompt.
          !(
            !INCLUDE_TRACKING_PERMISSION &&
            (p === "expo-tracking-transparency" ||
              (Array.isArray(p) && p[0] === "expo-tracking-transparency"))
          ) &&
          // Provide the Face ID permission consistently from dynamic config.
          !(Array.isArray(p) && p[0] === "expo-local-authentication") &&
          // Keep SecureStore in the dynamic config only once.
          p !== "expo-secure-store"
      ),
      "expo-secure-store",
      [
        "expo-local-authentication",
        {
          faceIDPermission: FACE_ID_PERMISSION,
        },
      ],
      ...(INCLUDE_MOBILE_ADS_SDK
        ? [
            [
              "react-native-google-mobile-ads",
              {
                androidAppId: ADMOB_ANDROID_APP_ID,
                iosAppId: ADMOB_IOS_APP_ID,
                userTrackingUsageDescription:
                  "Wir nutzen deine Gerätedaten nur mit deiner Zustimmung für personalisierte Werbung, damit clearn kostenlos bleiben kann.",
                skAdNetworkItems: [
                  "cstr6suwn9.skadnetwork",
                  "4fzdc2evr5.skadnetwork",
                  "2fnua5tdw4.skadnetwork",
                  "ydx93a7ass.skadnetwork",
                  "5a6flpkh64.skadnetwork",
                  "p78axxw29g.skadnetwork",
                  "v72qych5uu.skadnetwork",
                  "ludvb6z3bs.skadnetwork",
                  "cp8zw746q7.skadnetwork",
                  "3sh42y64l3.skadnetwork",
                  "c6k4g5qg8m.skadnetwork",
                  "s39g8k73mm.skadnetwork",
                  "3qy4746246.skadnetwork",
                  "f38h382jlk.skadnetwork",
                  "hs6bdukanm.skadnetwork",
                  "v4nxqhlyqp.skadnetwork",
                  "wzmmZ9fp2w.skadnetwork",
                  "su67r6k2v3.skadnetwork",
                  "yclnxrl5pm.skadnetwork",
                  "t38b2kh725.skadnetwork",
                ],
              },
            ],
          ]
        : []),
      ...(SENTRY_DSN ? ["@sentry/react-native"] : []),
    ],
  };

  // EAS file env var: GOOGLE_SERVICES_JSON points to a temp file during build
  if (process.env.GOOGLE_SERVICES_JSON) {
    result.android.googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  }

  return result;
};
