import { describe, expect, it } from "vitest";
import {
  mapRevenueCatEventToSubscription,
  resolveTierFromRevenueCatEntitlements,
} from "@/services/revenueCatService";

describe("revenueCatService", () => {
  it("resolves entitlement IDs to lifetime and pro tiers", () => {
    expect(resolveTierFromRevenueCatEntitlements(["pro_monthly"])).toBe("pro");
    expect(resolveTierFromRevenueCatEntitlements(["vip_lifetime"])).toBe(
      "lifetime"
    );
    expect(resolveTierFromRevenueCatEntitlements(["starter"])).toBe("free");
  });

  it("maps active pro event with future expiration", () => {
    const now = new Date("2026-02-12T12:00:00.000Z");
    const result = mapRevenueCatEventToSubscription(
      {
        app_user_id: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
        type: "RENEWAL",
        entitlement_ids: ["pro"],
        expiration_at_ms: new Date("2026-03-12T12:00:00.000Z").getTime(),
      },
      now
    );

    expect(result.tier).toBe("pro");
    expect(result.isActive).toBe(true);
    expect(result.expiresAt).toBe("2026-03-12T12:00:00.000Z");
  });

  it("downgrades expired paid events to free", () => {
    const now = new Date("2026-02-12T12:00:00.000Z");
    const result = mapRevenueCatEventToSubscription(
      {
        app_user_id: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
        type: "EXPIRATION",
        entitlement_ids: ["pro"],
        expiration_at_ms: new Date("2026-01-12T12:00:00.000Z").getTime(),
      },
      now
    );

    expect(result).toEqual({
      tier: "free",
      isActive: false,
      expiresAt: null,
    });
  });

  it("keeps lifetime active without expiration", () => {
    const result = mapRevenueCatEventToSubscription(
      {
        app_user_id: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
        type: "NON_RENEWING_PURCHASE",
        entitlement_ids: ["lifetime"],
        expiration_at_ms: null,
      },
      new Date("2026-02-12T12:00:00.000Z")
    );

    expect(result).toEqual({
      tier: "lifetime",
      isActive: true,
      expiresAt: null,
    });
  });

  it("returns free when no paid entitlement exists", () => {
    const result = mapRevenueCatEventToSubscription(
      {
        app_user_id: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
        type: "TRANSFER",
        entitlement_ids: [],
        expiration_at_ms: null,
      },
      new Date("2026-02-12T12:00:00.000Z")
    );

    expect(result).toEqual({
      tier: "free",
      isActive: false,
      expiresAt: null,
    });
  });

  it("keeps access active when entitlement IDs are missing but expiry is in future", () => {
    const now = new Date("2026-02-12T12:00:00.000Z");
    const result = mapRevenueCatEventToSubscription(
      {
        app_user_id: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
        type: "CANCELLATION",
        entitlement_ids: undefined,
        expiration_at_ms: new Date("2026-03-12T12:00:00.000Z").getTime(),
      },
      now
    );

    expect(result).toEqual({
      tier: "pro",
      isActive: true,
      expiresAt: "2026-03-12T12:00:00.000Z",
    });
  });
});
