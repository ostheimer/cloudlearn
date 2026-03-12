export type SubscriptionTier = "free" | "pro";

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

function matchesPro(identifier: string): boolean {
  return identifier.includes(PRO_ENTITLEMENT_HINT);
}

export function resolveTierFromEntitlementIds(
  entitlementIds: string[]
): SubscriptionTier {
  const normalized = entitlementIds.map(normalizeIdentifier);
  if (normalized.some(matchesPro)) return "pro";
  return "free";
}

export function deriveSubscriptionFromEntitlements(
  entitlements: RevenueCatEntitlementSnapshot[],
  now = new Date()
): SubscriptionSnapshot {
  const nowMs = now.getTime();
  const activeEntitlements = entitlements.filter((e) => isEntitlementActive(e, nowMs));
  const tier = resolveTierFromEntitlementIds(
    activeEntitlements.map((e) => e.identifier)
  );

  if (tier === "free") {
    return { tier: "free", isActive: false, expiresAt: null };
  }

  const matchedEntitlement =
    activeEntitlements.find((e) => matchesPro(normalizeIdentifier(e.identifier))) ?? null;

  const expiresAt =
    matchedEntitlement && isValidDateString(matchedEntitlement.expirationDate)
      ? new Date(matchedEntitlement.expirationDate).toISOString()
      : null;

  return { tier, isActive: true, expiresAt };
}
