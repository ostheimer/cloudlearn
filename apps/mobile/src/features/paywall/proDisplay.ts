import type { SubscriptionTier } from "./subscriptionMapping";

/**
 * Anzeige-Regeln rund um Tarif, Paywall und LP-Fenster (#607).
 *
 * Reine Funktionen statt Logik in den Screens, damit die Regeln testbar
 * sind, ohne React-Native zu rendern. Alle Rückgaben sind i18n-Schlüssel
 * oder nackte Werte — die Screens übersetzen selbst.
 */

export function isPaidTier(tier: SubscriptionTier): boolean {
  return tier === "pro" || tier === "lifetime";
}

/**
 * Welche Auswege das „Nicht genug LP"-Fenster anbietet.
 *
 * Pro/Lifetime: die Werbe-Tageskappe ist 0 (ein „+5 LP sofort" würde nie
 * gebucht) und ein Pro-Upgrade gibt es nicht zu kaufen — beide Auswege sind
 * nur für Free-Konten ehrlich. Das LP-Pack bleibt für alle.
 */
export function lpInsufficientOptions(tier: SubscriptionTier): {
  showWatchAd: boolean;
  showUpgrade: boolean;
} {
  const paid = isPaidTier(tier);
  return { showWatchAd: !paid, showUpgrade: !paid };
}

/** Untertitel der Paywall: werben nur bei Free, Bestätigung bei bezahlt. */
export function paywallSubtitleKey(tier: SubscriptionTier): string {
  return isPaidTier(tier) ? "paywall.subtitlePro" : "paywall.subtitle";
}

/** Anzeige-Etikett des Tarifs — Lifetime heißt Lifetime, nicht „Pro". */
export function tierLabelKey(tier: SubscriptionTier): string {
  if (tier === "lifetime") return "paywall.tierLifetime";
  if (tier === "pro") return "paywall.tierPro";
  return "paywall.tierFree";
}

/**
 * Wie viele KI-Scans ein LP-Pack ungefähr ergibt — mit dem ECHTEN Scan-Preis
 * des Tarifs (Pro zahlt 5 LP, Free 10). Die alte, harte „/10"-Rechnung zeigte
 * Pro-Konten nur die Hälfte ihrer wahren Scans (#607). Fällt auf 10 zurück,
 * solange der Preis noch nicht vom Server geladen ist.
 */
export function scansForLpPack(packLp: number, lpCostAiScan: number): number {
  const cost = lpCostAiScan > 0 ? lpCostAiScan : 10;
  return Math.floor(packLp / cost);
}

/** Ob unter dem Tarif ein „Bezahlt bis …"-Datum stehen soll (nur Abo). */
export function showsPaidUntil(
  tier: SubscriptionTier,
  expiresAt: string | null | undefined
): boolean {
  return tier === "pro" && Boolean(expiresAt);
}

/** Fehlertext, wenn LP-Packs im Build nicht kaufbar sind, je Tarif. */
export function packUnavailableBodyKey(tier: SubscriptionTier): string {
  return isPaidTier(tier)
    ? "lp.purchaseUnavailableBodyPro"
    : "lp.purchaseUnavailableBody";
}
