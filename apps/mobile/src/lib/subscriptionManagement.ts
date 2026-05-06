export type SubscriptionStorePlatform = "ios" | "android" | "web" | string;

const IOS_SUBSCRIPTION_MANAGEMENT_URLS = [
  "itms-apps://apps.apple.com/account/subscriptions",
  "https://apps.apple.com/account/subscriptions",
];

const ANDROID_SUBSCRIPTION_MANAGEMENT_URLS = [
  "https://play.google.com/store/account/subscriptions?package=app.clearn",
  "https://play.google.com/store/account/subscriptions",
];

export function getSubscriptionManagementUrls(
  platform: SubscriptionStorePlatform
): string[] {
  if (platform === "ios") {
    return IOS_SUBSCRIPTION_MANAGEMENT_URLS;
  }

  if (platform === "android") {
    return ANDROID_SUBSCRIPTION_MANAGEMENT_URLS;
  }

  return [];
}
