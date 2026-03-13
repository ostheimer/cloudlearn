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

/** @type {import('@expo/config').ExpoConfig} */
module.exports = ({ config }) => ({
  ...config,
  name: IS_DEV ? "clearn (Dev)" : IS_PREVIEW ? "clearn (Preview)" : "clearn",
  slug: "clearn",
  ios: {
    ...config.ios,
    infoPlist: {
      ...config.ios?.infoPlist,
      GADApplicationIdentifier: ADMOB_IOS_APP_ID,
    },
  },
  plugins: [
    ...(config.plugins ?? []).filter(
      (p) =>
        // Remove the static react-native-google-mobile-ads entry — we provide it below
        !(Array.isArray(p) && p[0] === "react-native-google-mobile-ads")
    ),
    [
      "react-native-google-mobile-ads",
      {
        androidAppId: ADMOB_ANDROID_APP_ID,
        iosAppId: ADMOB_IOS_APP_ID,
        userTrackingUsageDescription:
          "Wir verwenden deine Gerätedaten, um relevante Werbung anzuzeigen und clearn kostenlos zu halten.",
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
});
