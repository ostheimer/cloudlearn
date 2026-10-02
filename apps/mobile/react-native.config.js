// Expo Autolinking loads this file as CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { realAdsEnabled } = require("./ads-mode.json");

const appVariant =
  process.env.APP_VARIANT ??
  process.env.EXPO_PUBLIC_APP_VARIANT ??
  "development";
const excludeMobileAds = appVariant === "production" && !realAdsEnabled;

module.exports = {
  dependencies: excludeMobileAds
    ? {
        "react-native-google-mobile-ads": {
          platforms: {
            ios: null,
            android: null,
          },
        },
      }
    : {},
};
