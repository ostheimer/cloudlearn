import { getLimitsForTier } from "@/lib/featureGates";
import type { TierLimits } from "@/lib/featureGates";
import type { SubscriptionTier } from "@/lib/contracts";
import { HttpError } from "@/lib/http";
import {
  DECK_FULL,
  DECK_LIMIT_REACHED,
  IMPORT_LIMIT_STATUS,
} from "@/lib/importCapacity";

/**
 * Höchstlänge für Deck- und Ordner-Titel (#612). Vorher gab es keine Grenze —
 * tausende Zeichen liessen sich als Titel speichern und sprengten jede Liste.
 * 120 Zeichen reichen für jede echte Überschrift; Langtext gehört in die
 * Beschreibung (500). Die Clients stoppen die Eingabe beim selben Wert
 * (App: titleLimit.ts, Web: maxLength an den Namensfeldern).
 */
export const TITLE_MAX = 120;

// The boolean, per-tier Pro entitlements in TierLimits. Kept as a keyof so a
// new feature flag automatically becomes assertable without touching this type.
export type EntitlementFeature = {
  [K in keyof TierLimits]: TierLimits[K] extends boolean ? K : never;
}[keyof TierLimits];

/**
 * Would moving to Pro actually raise this limit?
 *
 * Decides between "upgrading helps" and "this is the ceiling". Someone on Pro
 * or Lifetime whose deck is full has nothing left to buy — telling them to
 * upgrade is the bug this module fixes (#371).
 */
function upgradeWouldHelp(tier: SubscriptionTier, limit: keyof TierLimits): boolean {
  const current = getLimitsForTier(tier)[limit];
  const pro = getLimitsForTier("pro")[limit];
  return typeof current === "number" && typeof pro === "number" && pro > current;
}

const upgradeHint = " Mit Pro hast du deutlich mehr Platz.";

/**
 * Plan limits, enforced server-side (never trust the client).
 *
 * All three rejections below used to be 402/PAYWALL_REQUIRED — the same answer
 * a Pro-only feature gives. A client could only tell "deck full" from "needs
 * Pro" by matching the English message text, and the mobile app turned every
 * 402 into the "buy Lernpunkte" modal. A Pro user with a full deck was told to
 * buy points, and Pro, for things she already had (#371).
 *
 * The vocabulary here is deliberately the SAME one the import path introduced
 * in `importCapacity.ts` (#428) rather than a second, competing set:
 *
 *   - 409 + DECK_LIMIT_REACHED — no room for another deck
 *   - 409 + DECK_FULL          — this deck cannot take another card
 *   - 402 + PAYWALL_REQUIRED   — genuinely a Pro-only feature
 *
 * Why 409 and not 402 (reasoning taken from importCapacity.ts, which applies
 * verbatim here): a limit is a conflict with the current state, not a missing
 * payment — and shipped app builds match 409 nowhere, so they fall through to
 * their generic error alert and show the message as-is. That is why these
 * messages are German: on those builds they are what the learner reads.
 */
export function assertDeckLimit(tier: SubscriptionTier, currentDeckCount: number): void {
  const { maxDecks } = getLimitsForTier(tier);
  if (currentDeckCount >= maxDecks) {
    throw new HttpError(
      `Deck-Grenze erreicht: Dein Tarif erlaubt ${maxDecks} Decks.` +
        (upgradeWouldHelp(tier, "maxDecks")
          ? upgradeHint
          : " Mehr sind nicht möglich — lösche ein Deck, um Platz zu schaffen."),
      IMPORT_LIMIT_STATUS,
      DECK_LIMIT_REACHED
    );
  }
}

export function assertCardLimit(tier: SubscriptionTier, currentCardCount: number): void {
  const { maxCardsPerDeck } = getLimitsForTier(tier);
  if (currentCardCount >= maxCardsPerDeck) {
    throw new HttpError(
      `Dieses Deck ist voll: Dein Tarif erlaubt ${maxCardsPerDeck} Karten pro Deck.` +
        (upgradeWouldHelp(tier, "maxCardsPerDeck")
          ? upgradeHint
          : " Leg für weitere Karten ein zweites Deck an."),
      IMPORT_LIMIT_STATUS,
      DECK_FULL
    );
  }
}

// Server-side Pro-feature gate (#235). Free tiers must not reach Pro-only server
// endpoints just because they can craft the request. This is the ONE case where
// "you need Pro" is literally true, so it keeps 402/PAYWALL_REQUIRED — and the
// mobile paywall trigger, which keys off that code, now only fires when buying
// Pro is genuinely the answer. Deliberately not used for `pdfImport`, which is
// an LP-paid feature for every tier by design (MONETIZATION_CONCEPT.md 3.1 / #84).
export function assertEntitlement(tier: SubscriptionTier, feature: EntitlementFeature): void {
  if (!getLimitsForTier(tier)[feature]) {
    throw new HttpError(
      "This feature requires Pro. Upgrade to unlock it.",
      402,
      "PAYWALL_REQUIRED"
    );
  }
}

// Advanced statistics gate (#235). Everyone keeps the basic stats tab; the
// longer 30-day history is the Pro ("advanced") stat. Non-entitled tiers are
// clamped down to the 7-day window rather than rejected, so the basic tab keeps
// working for free users instead of erroring out.
export function effectiveStatsWindowDays(
  tier: SubscriptionTier,
  requestedDays: 7 | 30
): 7 | 30 {
  return getLimitsForTier(tier).advancedStats ? requestedDays : 7;
}
