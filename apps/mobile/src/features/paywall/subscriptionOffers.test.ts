import { describe, expect, it } from "vitest";
import {
  filterSubscriptionOffers,
  isSubscriptionOffer,
} from "./subscriptionOffers";
import type { RevenueCatOffer } from "./revenuecat";

function offer(identifier: string, packageType: string): RevenueCatOffer {
  return {
    identifier,
    title: identifier,
    description: "",
    priceString: "4,99 €",
    packageType,
  };
}

describe("subscription offers", () => {
  it("keeps subscription and lifetime packages on the paywall", () => {
    const offers = [
      offer("$rc_annual", "ANNUAL"),
      offer("$rc_monthly", "MONTHLY"),
      offer("$rc_lifetime", "LIFETIME"),
    ];

    expect(filterSubscriptionOffers(offers)).toEqual(offers);
  });

  it("excludes custom consumable packages from the paywall", () => {
    const lpPack = offer("lp_pack_300", "CUSTOM");

    expect(isSubscriptionOffer(lpPack)).toBe(false);
    expect(
      filterSubscriptionOffers([
        offer("$rc_annual", "ANNUAL"),
        lpPack,
        offer("$rc_monthly", "MONTHLY"),
      ])
    ).toEqual([offer("$rc_annual", "ANNUAL"), offer("$rc_monthly", "MONTHLY")]);
  });

  it("allows future recurring subscription package periods", () => {
    expect(isSubscriptionOffer(offer("pro_weekly", "WEEKLY"))).toBe(true);
    expect(isSubscriptionOffer(offer("pro_six_month", "SIX_MONTH"))).toBe(true);
  });
});
