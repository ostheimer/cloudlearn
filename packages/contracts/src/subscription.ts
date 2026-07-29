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
    // TRANSFER-Ereignisse haben laut RevenueCat-Doku KEIN app_user_id — sie
    // benennen die Konten über transferred_from/transferred_to. Mit einem
    // Pflichtfeld prallte jeder echte Gerätewechsel am Schema ab (#607).
    app_user_id: z.string().optional(),
    type: z.string(),
    entitlement_ids: z.array(z.string()).optional(),
    expiration_at_ms: z.number().int().nullable().optional(),
    // Fields present for one-time purchases (consumable LP packs)
    product_id: z.string().optional(),
    transaction_id: z.string().optional(),
    store_transaction_id: z.string().optional(),
    // TRANSFER only: store transactions moved between these app user ids
    transferred_from: z.array(z.string()).optional(),
    transferred_to: z.array(z.string()).optional()
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
  // Only "session" remains. "dailyGoal" and "ad" were retired as client-asserted
  // self-grants: "ad" now requires AdMob Server-Side Verification (Google → server),
  // granted via a dedicated SSV endpoint, not this JWT route (#149).
  type: z.enum(["session"]),
  // Accepted for backward compatibility with shipped clients, but ignored server-side:
  // the "session" grant is derived from server-recorded reviews, not this count.
  sessionCardCount: z.number().int().optional(),
});
export type LpEarnRequest = z.infer<typeof lpEarnRequestSchema>;
