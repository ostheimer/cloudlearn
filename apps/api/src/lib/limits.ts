import { getLimitsForTier } from "@/lib/featureGates";
import type { SubscriptionTier } from "@/lib/contracts";
import { HttpError } from "@/lib/http";

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
