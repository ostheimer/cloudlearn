import type { SubscriptionTier } from "./contracts";

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
