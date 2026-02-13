import type { RevenueCatWebhook } from "@/lib/contracts";

type SubscriptionTier = "free" | "pro" | "lifetime";

const PRO_ENTITLEMENT_HINT = "pro";
const LIFETIME_ENTITLEMENT_HINT = "lifetime";

function normalizeEntitlementIds(entitlementIds?: string[]): string[] {
  return (entitlementIds ?? []).map((id) => id.trim().toLowerCase());
}

export function resolveTierFromRevenueCatEntitlements(
  entitlementIds?: string[]
): SubscriptionTier {
  const normalized = normalizeEntitlementIds(entitlementIds);
  if (normalized.some((id) => id.includes(LIFETIME_ENTITLEMENT_HINT))) {
    return "lifetime";
  }
  if (normalized.some((id) => id.includes(PRO_ENTITLEMENT_HINT))) {
    return "pro";
  }
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
