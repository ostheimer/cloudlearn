// Shared by Expo's CommonJS config and the release-readiness scripts.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const adsMode = require("../ads-mode.json");
function releasePlatforms({ args = [], env = process.env } = {}) {
  const index = args.indexOf("--platform");
  const requested = index >= 0 ? args[index + 1] : env.RELEASE_PLATFORM;
  const native = env.EAS_BUILD_PLATFORM;
  for (const value of [requested, native]) {
    if (value !== undefined && !["ios", "android", "all"].includes(value)) {
      throw new Error("Release platform must be ios, android, or all.");
    }
  }
  if (index >= 0 && requested === undefined) throw new Error("--platform requires a value.");
  if (native && native !== "all" && requested && requested !== "all" && requested !== native) {
    throw new Error("Release platform conflicts with EAS_BUILD_PLATFORM.");
  }
  const selected = requested ?? native ?? "all";
  return selected === "all" ? ["ios", "android"] : [selected];
}

function productionVariables(platform, { realAdsEnabled = adsMode.realAdsEnabled } = {}) {
  const suffix = platform.toUpperCase();
  const variables = [
    { name: `EXPO_PUBLIC_REVENUECAT_${suffix}_API_KEY`, pattern: platform === "ios" ? /^appl_[A-Za-z0-9_]+$/ : /^goog_[A-Za-z0-9_]+$/ },
  ];
  if (realAdsEnabled) {
    variables.unshift(
      { name: `EXPO_PUBLIC_ADMOB_APP_${suffix}_ID`, pattern: /^ca-app-pub-\d{16}~\d{10}$/ },
      { name: `EXPO_PUBLIC_ADMOB_REWARDED_${suffix}_ID`, pattern: /^ca-app-pub-\d{16}\/\d{10}$/ },
    );
  }
  return variables;
}

function validProductionValue(value, pattern) {
  return Boolean(value) && pattern.test(value) &&
    !/xxxxxxxx/i.test(value) && !value.startsWith("your-") &&
    !value.startsWith("ca-app-pub-3940256099942544");
}

module.exports = {
  realAdsEnabled: adsMode.realAdsEnabled,
  releasePlatforms,
  productionVariables,
  validProductionValue,
};
