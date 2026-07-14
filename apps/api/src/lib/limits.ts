import { getLimitsForTier } from "@/lib/featureGates";
import type { TierLimits } from "@/lib/featureGates";
import type { SubscriptionTier } from "@/lib/contracts";
import { HttpError } from "@/lib/http";

// The boolean, per-tier Pro entitlements in TierLimits. Kept as a keyof so a
// new feature flag automatically becomes assertable without touching this type.
export type EntitlementFeature = {
  [K in keyof TierLimits]: TierLimits[K] extends boolean ? K : never;
}[keyof TierLimits];

// Enforce plan limits server-side (never trust the client). 402/PAYWALL_REQUIRED
// makes the mobile app open the paywall automatically.
export function assertDeckLimit(tier: SubscriptionTier, currentDeckCount: number): void {
  const { maxDecks } = getLimitsForTier(tier);
  if (currentDeckCount >= maxDecks) {
    throw new HttpError(
      `Your plan allows up to ${maxDecks} decks. Upgrade to Pro for more.`,
      402,
      "PAYWALL_REQUIRED",
    );
  }
}

export function assertCardLimit(tier: SubscriptionTier, currentCardCount: number): void {
  const { maxCardsPerDeck } = getLimitsForTier(tier);
  if (currentCardCount >= maxCardsPerDeck) {
    throw new HttpError(
      `Your plan allows up to ${maxCardsPerDeck} cards per deck. Upgrade to Pro for more.`,
      402,
      "PAYWALL_REQUIRED",
    );
  }
}

// Server-side Pro-feature gate (#235). Free tiers must not reach Pro-only server
// endpoints just because they can craft the request. 402/PAYWALL_REQUIRED makes
// the mobile app open the paywall automatically — same contract as the limits
// above. Deliberately not used for `pdfImport`, which is an LP-paid feature for
// every tier by design (see MONETIZATION_CONCEPT.md 3.1 / #84).
export function assertEntitlement(tier: SubscriptionTier, feature: EntitlementFeature): void {
  if (!getLimitsForTier(tier)[feature]) {
    throw new HttpError(
      "This feature requires Pro. Upgrade to unlock it.",
      402,
      "PAYWALL_REQUIRED",
    );
  }
}

// Advanced statistics gate (#235). Everyone keeps the basic stats tab; the
// longer 30-day history is the Pro ("advanced") stat. Non-entitled tiers are
// clamped down to the 7-day window rather than rejected, so the basic tab keeps
// working for free users instead of erroring out.
export function effectiveStatsWindowDays(
  tier: SubscriptionTier,
  requestedDays: 7 | 30,
): 7 | 30 {
  return getLimitsForTier(tier).advancedStats ? requestedDays : 7;
}
