import { describe, expect, it } from "vitest";
import { getSubscriptionManagementUrls } from "./subscriptionManagement";

describe("subscription management links", () => {
  it("prefers the native App Store subscription screen on iOS", () => {
    expect(getSubscriptionManagementUrls("ios")).toEqual([
      "itms-apps://apps.apple.com/account/subscriptions",
      "https://apps.apple.com/account/subscriptions",
    ]);
  });

  it("opens Google Play subscription management on Android", () => {
    expect(getSubscriptionManagementUrls("android")).toEqual([
      "https://play.google.com/store/account/subscriptions?package=app.clearn",
      "https://play.google.com/store/account/subscriptions",
    ]);
  });

  it("returns no store URL for unsupported platforms", () => {
    expect(getSubscriptionManagementUrls("web")).toEqual([]);
  });
});
