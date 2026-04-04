import type { RevenueCatWebhook, SubscriptionTier } from "@/lib/contracts";

const PRO_ENTITLEMENT_HINT = (
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_PRO ?? "pro"
).toLowerCase();
const LIFETIME_ENTITLEMENT_HINT = (
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_LIFETIME ?? "lifetime"
).toLowerCase();

function normalizeEntitlementIds(entitlementIds?: string[]): string[] {
  return (entitlementIds ?? []).map((id) => id.trim().toLowerCase());
}

function resolvePaidTier(
  identifier: string
): Exclude<SubscriptionTier, "free"> | null {
  if (identifier.includes(LIFETIME_ENTITLEMENT_HINT)) {
    return "lifetime";
  }
  if (identifier.includes(PRO_ENTITLEMENT_HINT)) {
    return "pro";
  }
  return null;
}

export function resolveTierFromRevenueCatEntitlements(
  entitlementIds?: string[]
): SubscriptionTier {
  const paidTiers = normalizeEntitlementIds(entitlementIds).map(resolvePaidTier);
  if (paidTiers.includes("lifetime")) return "lifetime";
  if (paidTiers.includes("pro")) return "pro";
  return "free";
}

function toIsoDateOrNull(timestampMs?: number | null): string | null {
  if (typeof timestampMs !== "number" || !Number.isFinite(timestampMs)) {
    return null;
  }

  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function mapRevenueCatEventToSubscription(
  event: RevenueCatWebhook["event"],
  now = new Date()
): { tier: SubscriptionTier; isActive: boolean; expiresAt: string | null } {
  const tierFromEntitlements = resolveTierFromRevenueCatEntitlements(
    event.entitlement_ids
  );
  const expiresAt = toIsoDateOrNull(event.expiration_at_ms);
  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
  const hasFutureExpiry =
    Number.isFinite(expiresAtMs) && expiresAtMs > now.getTime();

  if (tierFromEntitlements === "free") {
    if (hasFutureExpiry) {
      // RevenueCat can send events with missing entitlement IDs while access is
      // still valid until expiry (e.g. cancellation without immediate revoke).
      return { tier: "pro", isActive: true, expiresAt };
    }
    return { tier: "free", isActive: false, expiresAt: null };
  }

  const isActive = !expiresAt || new Date(expiresAt).getTime() > now.getTime();
  if (!isActive) {
    return { tier: "free", isActive: false, expiresAt: null };
  }

  return {
    tier: tierFromEntitlements,
    isActive: true,
    expiresAt,
  };
}
