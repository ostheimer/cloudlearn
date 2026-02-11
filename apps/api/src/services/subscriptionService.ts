import { subscriptionStatusSchema, type SubscriptionStatus } from "@/lib/contracts";
import { getSubscriptionTier, updateSubscriptionTier } from "@/lib/db";

export async function getSubscriptionStatus(
  userId: string
): Promise<SubscriptionStatus> {
  const { tier, expiresAt, isActive } = await getSubscriptionTier(userId);
  return {
    userId,
    tier: tier as "free" | "pro",
    isActive,
    expiresAt,
  };
}

export async function updateSubscriptionStatus(
  input: SubscriptionStatus
): Promise<SubscriptionStatus> {
  const parsed = subscriptionStatusSchema.parse(input);
  await updateSubscriptionTier(
    parsed.userId,
    parsed.tier,
    parsed.isActive,
    parsed.expiresAt
  );
  return parsed;
}
