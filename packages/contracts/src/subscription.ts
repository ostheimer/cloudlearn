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
