import { describe, expect, it } from "vitest";
import {
  deriveSubscriptionFromEntitlements,
  resolveTierFromEntitlementIds,
} from "./subscriptionMapping";

const NOW = new Date("2026-02-12T12:00:00.000Z");

describe("subscription mapping", () => {
  it("maps pro entitlement to active pro tier", () => {
    const snapshot = deriveSubscriptionFromEntitlements(
      [{ identifier: "pro", expirationDate: "2026-03-01T00:00:00.000Z" }],
      NOW
    );

    expect(snapshot).toEqual({
      tier: "pro",
      isActive: true,
      expiresAt: "2026-03-01T00:00:00.000Z",
    });
  });

  it("prefers lifetime over pro when both are active", () => {
    const snapshot = deriveSubscriptionFromEntitlements(
      [
        { identifier: "pro_monthly", expirationDate: "2026-03-01T00:00:00.000Z" },
        { identifier: "lifetime", expirationDate: null },
      ],
      NOW
    );

    expect(snapshot.tier).toBe("lifetime");
    expect(snapshot.isActive).toBe(true);
    expect(snapshot.expiresAt).toBeNull();
  });

  it("downgrades to free when entitlement is expired", () => {
    const snapshot = deriveSubscriptionFromEntitlements(
      [{ identifier: "pro", expirationDate: "2026-01-01T00:00:00.000Z" }],
      NOW
    );

    expect(snapshot).toEqual({
      tier: "free",
      isActive: false,
      expiresAt: null,
    });
  });

  it("ignores unknown entitlements for tier resolution", () => {
    expect(resolveTierFromEntitlementIds(["starter", "trial"])).toBe("free");
  });

  it("treats missing expiration as active entitlement", () => {
    const snapshot = deriveSubscriptionFromEntitlements(
      [{ identifier: "pro", expirationDate: null }],
      NOW
    );

    expect(snapshot.tier).toBe("pro");
    expect(snapshot.isActive).toBe(true);
    expect(snapshot.expiresAt).toBeNull();
  });
});
