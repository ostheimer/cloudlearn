import type { SubscriptionTier } from "./subscription";

// Defines the monthly limits and feature availability per subscription tier.
// Used by both backend (enforcement) and mobile (UI gating + indicators).
export interface TierLimits {
  aiScansPerMonth: number;
  urlImportsPerMonth: number;
  maxDecks: number;
  maxCards: number;
  pdfImport: boolean;
  imageOcclusion: boolean;
  offlineDownload: boolean;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    aiScansPerMonth: 5,
    urlImportsPerMonth: 2,
    maxDecks: 10,
    maxCards: 100,
    pdfImport: false,
    imageOcclusion: false,
    offlineDownload: false,
  },
  pro: {
    aiScansPerMonth: Infinity,
    urlImportsPerMonth: Infinity,
    maxDecks: Infinity,
    maxCards: Infinity,
    pdfImport: true,
    imageOcclusion: true,
    offlineDownload: true,
  },
  lifetime: {
    aiScansPerMonth: Infinity,
    urlImportsPerMonth: Infinity,
    maxDecks: Infinity,
    maxCards: Infinity,
    pdfImport: true,
    imageOcclusion: true,
    offlineDownload: true,
  },
};

export function getLimitsForTier(tier: SubscriptionTier): TierLimits {
  return TIER_LIMITS[tier];
}

export function isUnlimited(value: number): boolean {
  return !Number.isFinite(value);
}
