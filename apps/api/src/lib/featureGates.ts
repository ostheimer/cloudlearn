import type { SubscriptionTier } from "./contracts";

// Runtime source of truth for the LP economy (server is authoritative).
// A deliberate copy lives in packages/contracts/src/featureGates.ts; the
// lpEconomyConsistency guard in packages/testkit fails CI if the two drift
// apart, and also checks the mobile pack list. Change both together (#212).

export interface TierLimits {
  maxDecks: number;
  maxCardsPerDeck: number;
  lpGrantPerMonth: number;
  lpEarnCapPerDay: number;
  lpAdCapPerDay: number;
  lpCostAiScan: number;
  lpCostUrlImport: number;
  lpCostPdfImport: number;
  pdfImport: boolean;
  imageOcclusion: boolean;
  offlineDownload: boolean;
  advancedStats: boolean;
  adFree: boolean;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    maxDecks: 10,
    maxCardsPerDeck: 100,
    lpGrantPerMonth: 0,
    lpEarnCapPerDay: 30,
    lpAdCapPerDay: 20,
    lpCostAiScan: 10,
    lpCostUrlImport: 15,
    lpCostPdfImport: 20,
    pdfImport: false,
    imageOcclusion: false,
    offlineDownload: false,
    advancedStats: false,
    adFree: false,
  },
  pro: {
    maxDecks: 500,
    maxCardsPerDeck: 2000,
    lpGrantPerMonth: 300,
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
  lifetime: {
    maxDecks: 500,
    maxCardsPerDeck: 2000,
    lpGrantPerMonth: 300,
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
  perReviewSession: 5,
  dailyGoalBonus: 10,
  streakDay7: 25,
  streakDay30: 100,
  streakDay100: 300,
  referralSender: 50,
  referralReceiver: 25,
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

// Streak repair (#237 follow-up): restore a lost streak after the fact. Priced
// above the freeze so the proactive freeze stays the better deal; only offered
// within `windowDays` local days of the loss.
export const STREAK_REPAIR = {
  costLp: 40,
  windowDays: 2,
} as const;

// Max number of paid referrals a single referrer can earn the sender bonus for.
// Caps referral farming (#203): beyond this the claimer still gets their bonus,
// but the referrer no longer receives the referralSender payout.
export const REFERRAL_SENDER_CAP = 10;

// LP pack product IDs as sold via RevenueCat (consumable one-time purchases)
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
