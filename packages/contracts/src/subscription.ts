import { z } from "zod";

export const subscriptionTierSchema = z.enum(["free", "pro", "lifetime"]);
export type SubscriptionTier = z.infer<typeof subscriptionTierSchema>;

export const subscriptionStatusSchema = z.object({
  userId: z.string().uuid(),
  tier: subscriptionTierSchema,
  isActive: z.boolean(),
  expiresAt: z.string().datetime().nullable()
});

export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const revenueCatWebhookSchema = z.object({
  event: z.object({
    app_user_id: z.string(),
    type: z.string(),
    entitlement_ids: z.array(z.string()).optional(),
    expiration_at_ms: z.number().int().nullable().optional()
  })
});

export type RevenueCatWebhook = z.infer<typeof revenueCatWebhookSchema>;

// LP system schemas
export const lpTransactionTypeSchema = z.enum([
  "abo_grant",
  "earned",
  "purchased",
  "ad_reward",
  "referral",
  "spent",
  "win_back",
  "event_bonus",
  "admin",
]);
export type LpTransactionType = z.infer<typeof lpTransactionTypeSchema>;

export const lpTransactionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: lpTransactionTypeSchema,
  amount: z.number().int(),
  reason: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type LpTransaction = z.infer<typeof lpTransactionSchema>;

export const lpBalanceResponseSchema = z.object({
  balance: z.number().int().nonnegative(),
  earnedToday: z.number().int().nonnegative(),
  adsToday: z.number().int().nonnegative(),
  earnCapToday: z.number().int(),
  adCapToday: z.number().int(),
});
export type LpBalanceResponse = z.infer<typeof lpBalanceResponseSchema>;

export const lpSpendRequestSchema = z.object({
  feature: z.enum(["aiScan", "urlImport", "pdfImport"]),
});
export type LpSpendRequest = z.infer<typeof lpSpendRequestSchema>;

export const lpEarnRequestSchema = z.object({
  type: z.enum(["session", "dailyGoal", "ad"]),
  sessionCardCount: z.number().int().optional(),
});
export type LpEarnRequest = z.infer<typeof lpEarnRequestSchema>;
