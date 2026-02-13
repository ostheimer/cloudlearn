import { subscriptionStatusSchema, type SubscriptionStatus } from "@/lib/contracts";
import { getSubscriptionTier, updateSubscriptionTier } from "@/lib/db";

export async function getSubscriptionStatus(
  userId: string
): Promise<SubscriptionStatus> {
  const { tier, expiresAt, isActive } = await getSubscriptionTier(userId);
  const paidTier = tier === "pro" || tier === "lifetime";
  const effectiveIsActive = paidTier && isActive;
  const effectiveTier = effectiveIsActive ? tier : "free";

  return {
    userId,
    tier: effectiveTier,
    isActive: effectiveIsActive,
    expiresAt: effectiveIsActive ? expiresAt : null,
  };
}

export async function updateSubscriptionStatus(
  input: SubscriptionStatus
): Promise<SubscriptionStatus> {
  const parsed = subscriptionStatusSchema.parse(input);
  const normalized: SubscriptionStatus =
    parsed.tier === "free" || !parsed.isActive
      ? {
          ...parsed,
          tier: "free",
          isActive: false,
          expiresAt: null,
        }
      : parsed;

  await updateSubscriptionTier(
    normalized.userId,
    normalized.tier,
    normalized.isActive,
    normalized.expiresAt
  );
  return normalized;
}
