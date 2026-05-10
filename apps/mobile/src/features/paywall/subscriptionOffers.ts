import type { RevenueCatOffer } from "./revenuecat";

const SUBSCRIPTION_PACKAGE_TYPES = new Set([
  "LIFETIME",
  "ANNUAL",
  "SIX_MONTH",
  "THREE_MONTH",
  "TWO_MONTH",
  "MONTHLY",
  "WEEKLY",
]);

export function isSubscriptionOffer(offer: RevenueCatOffer): boolean {
  return SUBSCRIPTION_PACKAGE_TYPES.has(offer.packageType);
}

export function filterSubscriptionOffers(
  offers: readonly RevenueCatOffer[]
): RevenueCatOffer[] {
  return offers.filter(isSubscriptionOffer);
}
