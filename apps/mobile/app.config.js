// Dynamic Expo config — allows AdMob IDs and other values to be set
// via environment variables for different build environments.
// EAS Build injects EXPO_PUBLIC_* variables from eas.json "env" or Vercel/EAS secrets.

const IS_DEV = process.env.APP_VARIANT === "development";
const IS_PREVIEW = process.env.APP_VARIANT === "preview";

// AdMob: use real IDs in production, Google test IDs in dev/preview
const ADMOB_IOS_APP_ID =
  IS_DEV || IS_PREVIEW
    ? "ca-app-pub-3940256099942544~1458002511" // Google test app ID (iOS)
    : process.env.EXPO_PUBLIC_ADMOB_APP_IOS_ID ?? "ca-app-pub-3940256099942544~1458002511";

const ADMOB_ANDROID_APP_ID =
  IS_DEV || IS_PREVIEW
    ? "ca-app-pub-3940256099942544~3347511713" // Google test app ID (Android)
    : process.env.EXPO_PUBLIC_ADMOB_APP_ANDROID_ID ?? "ca-app-pub-3940256099942544~3347511713";

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
        !(Array.isArray(p) && p[0] === "expo-local-authentication")
    ),
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
