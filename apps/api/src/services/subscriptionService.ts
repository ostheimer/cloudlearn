import { subscriptionStatusSchema, type SubscriptionStatus } from "@/lib/contracts";

const subscriptions = new Map<string, SubscriptionStatus>();

export function getSubscriptionStatus(userId: string): SubscriptionStatus {
  const existing = subscriptions.get(userId);
  if (existing) {
    return existing;
  }

  const fallback: SubscriptionStatus = {
    userId,
    tier: "free",
    isActive: true,
    expiresAt: null
  };

  subscriptions.set(userId, fallback);
  return fallback;
}

export function updateSubscriptionStatus(input: SubscriptionStatus): SubscriptionStatus {
  const parsed = subscriptionStatusSchema.parse(input);
  subscriptions.set(parsed.userId, parsed);
  return parsed;
}

export function resetSubscriptionStore(): void {
  subscriptions.clear();
}
