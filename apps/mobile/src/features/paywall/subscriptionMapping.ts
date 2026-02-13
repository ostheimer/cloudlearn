export type SubscriptionTier = "free" | "pro" | "lifetime";

export interface RevenueCatEntitlementSnapshot {
  identifier: string;
  expirationDate: string | null;
}

export interface SubscriptionSnapshot {
  tier: SubscriptionTier;
  isActive: boolean;
  expiresAt: string | null;
}

const PRO_ENTITLEMENT_HINT = (
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_PRO ?? "pro"
).toLowerCase();

const LIFETIME_ENTITLEMENT_HINT = (
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_LIFETIME ?? "lifetime"
).toLowerCase();

function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

function isValidDateString(value: string | null): value is string {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function isEntitlementActive(
  entitlement: RevenueCatEntitlementSnapshot,
  nowMs: number
): boolean {
  if (!isValidDateString(entitlement.expirationDate)) {
    return true;
  }

  return new Date(entitlement.expirationDate).getTime() > nowMs;
}

function matchesTier(identifier: string, tier: SubscriptionTier): boolean {
  if (tier === "lifetime") {
    return identifier.includes(LIFETIME_ENTITLEMENT_HINT);
  }
  if (tier === "pro") {
    return identifier.includes(PRO_ENTITLEMENT_HINT);
  }
  return false;
}

export function resolveTierFromEntitlementIds(
  entitlementIds: string[]
): SubscriptionTier {
  const normalized = entitlementIds.map(normalizeIdentifier);

  if (normalized.some((id) => matchesTier(id, "lifetime"))) {
    return "lifetime";
  }
  if (normalized.some((id) => matchesTier(id, "pro"))) {
    return "pro";
  }
  return "free";
}

export function deriveSubscriptionFromEntitlements(
  entitlements: RevenueCatEntitlementSnapshot[],
  now = new Date()
): SubscriptionSnapshot {
  const nowMs = now.getTime();
  const activeEntitlements = entitlements.filter((entitlement) =>
    isEntitlementActive(entitlement, nowMs)
  );
  const tier = resolveTierFromEntitlementIds(
    activeEntitlements.map((entitlement) => entitlement.identifier)
  );

  if (tier === "free") {
    return { tier: "free", isActive: false, expiresAt: null };
  }

  const matchedEntitlement =
    activeEntitlements.find((entitlement) =>
      matchesTier(normalizeIdentifier(entitlement.identifier), tier)
    ) ?? null;

  const expiresAt =
    matchedEntitlement && isValidDateString(matchedEntitlement.expirationDate)
      ? new Date(matchedEntitlement.expirationDate).toISOString()
      : null;

  return {
    tier,
    isActive: true,
    expiresAt,
  };
}
