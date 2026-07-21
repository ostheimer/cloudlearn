import type { SubscriptionTier } from "./subscription";

// Defines hard limits and LP economy per subscription tier.
// "Unlimited" is intentionally avoided — every tier has real bounds.
// LP = Lernpunkte, the universal in-app currency.
export interface TierLimits {
  // Hard structural limits
  maxDecks: number;
  maxCardsPerDeck: number;

  // Monthly LP grant from subscription
  lpGrantPerMonth: number;

  // Max LP earnable through learning per day (streak/session)
  lpEarnCapPerDay: number;

  // Max rewarded-ad LP per day
  lpAdCapPerDay: number;

  // LP cost per AI feature usage (0 = free)
  lpCostAiScan: number;
  lpCostUrlImport: number;
  lpCostPdfImport: number;

  // Feature flags
  pdfImport: boolean;
  imageOcclusion: boolean;
  offlineDownload: boolean;
  advancedStats: boolean;
  adFree: boolean;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    // #411: raised from 10/100 — a chapter-wide scan (#399/#408) alone can
    // produce 100+ cards. Kept identical to apps/api/src/lib/featureGates.ts;
    // the lpEconomyConsistency guard in packages/testkit fails CI on drift.
    maxDecks: 20,
    maxCardsPerDeck: 150,
    lpGrantPerMonth: 0,      // no automatic monthly grant on free
    lpEarnCapPerDay: 30,     // earn up to 30 LP/day by learning
    lpAdCapPerDay: 20,       // earn up to 20 LP/day via rewarded ads
    lpCostAiScan: 10,        // 10 LP per AI scan
    lpCostUrlImport: 15,     // 15 LP per URL import
    lpCostPdfImport: 20,     // 20 LP per PDF import
    pdfImport: false,        // requires LP spend on free
    imageOcclusion: false,
    offlineDownload: false,
    advancedStats: false,
    adFree: false,
  },
  pro: {
    maxDecks: 500,
    maxCardsPerDeck: 2000,
    lpGrantPerMonth: 300,    // 300 LP/month included
    lpEarnCapPerDay: 100,    // higher earn cap
    lpAdCapPerDay: 0,        // no ads → no ad LP either
    lpCostAiScan: 5,         // discounted LP cost
    lpCostUrlImport: 8,
    lpCostPdfImport: 12,
    pdfImport: true,
    imageOcclusion: true,
    offlineDownload: true,
    advancedStats: true,
    adFree: true,
  },
  lifetime: {
    maxDecks: 500,
    maxCardsPerDeck: 2000,
    lpGrantPerMonth: 300,    // keep aligned with pro until lifetime gets its own economy
    lpEarnCapPerDay: 100,
    lpAdCapPerDay: 0,
    lpCostAiScan: 5,
    lpCostUrlImport: 8,
    lpCostPdfImport: 12,
    pdfImport: true,
    imageOcclusion: true,
    offlineDownload: true,
    advancedStats: true,
    adFree: true,
  },
};

export const LP_EARN_RULES = {
  perReviewSession: 1,    // LP per reviewed card (chunk size 1, see lpService)
  dailyGoalBonus: 10,     // extra LP when daily goal is hit
  streakDay7: 25,         // streak milestone bonus
  streakDay30: 100,
  streakDay100: 300,
  referralSender: 50,     // LP when referred user reaches 7-day streak
  referralReceiver: 25,   // new user signup bonus via referral
  firstDeck: 10,
  firstReview: 5,
} as const;

// Streak freeze store item (#237): bought with LP, consumed automatically when
// exactly one local day was missed. Same price for every tier — it is a
// habit-keeping item, not a capacity limit.
export const STREAK_FREEZE = {
  costLp: 20,
  maxOwned: 2,
} as const;

// Max number of paid referrals a single referrer can earn the sender bonus for.
// Caps referral farming (#203): beyond this the claimer still gets their bonus,
// but the referrer no longer receives the referralSender payout.
export const REFERRAL_SENDER_CAP = 10;

// LP pack product IDs as sold via RevenueCat (consumable one-time purchases).
// Keyed by product ID to match the runtime server source
// (apps/api/src/lib/featureGates.ts); the lpEconomyConsistency guard in
// packages/testkit asserts both stay identical.
export const LP_PACKS: Record<string, { lp: number; priceEur: number }> = {
  "lp_pack_100":  { lp: 100,  priceEur: 0.99 },
  "lp_pack_300":  { lp: 300,  priceEur: 2.49 },
  "lp_pack_750":  { lp: 750,  priceEur: 4.99 },
  "lp_pack_2000": { lp: 2000, priceEur: 9.99 },
};

export function getLimitsForTier(tier: SubscriptionTier): TierLimits {
  return TIER_LIMITS[tier];
}

export function lpCostForFeature(tier: SubscriptionTier, feature: "aiScan" | "urlImport" | "pdfImport"): number {
  const limits = TIER_LIMITS[tier];
  switch (feature) {
    case "aiScan":    return limits.lpCostAiScan;
    case "urlImport": return limits.lpCostUrlImport;
    case "pdfImport": return limits.lpCostPdfImport;
  }
}
