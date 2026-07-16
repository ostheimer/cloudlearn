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

function getRequiredProductionEnv(name) {
  const value = process.env[name]?.trim();
  if (value) return value;

  if (IS_PRODUCTION) {
    throw new Error(
      `${name} is required for production builds. Set it as an EAS secret before submitting clearn.`
    );
  }

  return null;
}

// AdMob: use real IDs in production, Google test IDs in dev/preview
const ADMOB_IOS_APP_ID =
  IS_PRODUCTION
    ? getRequiredProductionEnv("EXPO_PUBLIC_ADMOB_APP_IOS_ID")
    : GOOGLE_ADMOB_TEST_APP_IDS.ios; // Google test app ID (iOS)

const ADMOB_ANDROID_APP_ID =
  IS_PRODUCTION
    ? getRequiredProductionEnv("EXPO_PUBLIC_ADMOB_APP_ANDROID_ID")
    : GOOGLE_ADMOB_TEST_APP_IDS.android; // Google test app ID (Android)

if (IS_PRODUCTION) {
  getRequiredProductionEnv("EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID");
  getRequiredProductionEnv("EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID");
  getRequiredProductionEnv("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY");
  getRequiredProductionEnv("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY");
}

const FACE_ID_PERMISSION =
  "clearn verwendet Face ID, um deine eingeloggte App lokal zu entsperren.";

/** @type {import('@expo/config').ExpoConfig} */
module.exports = ({ config }) => {
  const runtimeVersion = IS_PREVIEW
    ? { policy: "fingerprint" }
    : config.runtimeVersion ?? { policy: "appVersion" };

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
        ...config.ios?.infoPlist,
        GADApplicationIdentifier: ADMOB_IOS_APP_ID,
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
    ],
  };

  // EAS file env var: GOOGLE_SERVICES_JSON points to a temp file during build
  if (process.env.GOOGLE_SERVICES_JSON) {
    result.android.googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  }

  return result;
};
