import { describe, it, expect } from "vitest";
import {
  assertDeckLimit,
  assertCardLimit,
  assertEntitlement,
  effectiveStatsWindowDays,
} from "../lib/limits";
import { getLimitsForTier } from "../lib/featureGates";
import { HttpError } from "../lib/http";

describe("free-tier server-side limit enforcement (#83)", () => {
  const freeDecks = getLimitsForTier("free").maxDecks;
  const freeCards = getLimitsForTier("free").maxCardsPerDeck;

  it("allows a free user below the deck limit", () => {
    expect(() => assertDeckLimit("free", freeDecks - 1)).not.toThrow();
  });

  it("blocks a free user at the deck limit with 402/PAYWALL_REQUIRED", () => {
    try {
      assertDeckLimit("free", freeDecks);
      throw new Error("expected assertDeckLimit to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(402);
      expect((e as HttpError).code).toBe("PAYWALL_REQUIRED");
    }
  });

  it("allows a pro user beyond the free deck limit", () => {
    expect(() => assertDeckLimit("pro", freeDecks)).not.toThrow();
  });

  it("blocks a free user at the per-deck card limit", () => {
    expect(() => assertCardLimit("free", freeCards)).toThrow(HttpError);
  });

  it("allows a free user below the card limit", () => {
    expect(() => assertCardLimit("free", freeCards - 1)).not.toThrow();
  });
});

describe("Pro-feature entitlement enforcement (#235)", () => {
  it("blocks a free user from a Pro-only feature with 402/PAYWALL_REQUIRED", () => {
    // Guard the premise: offlineDownload must actually be Pro-only.
    expect(getLimitsForTier("free").offlineDownload).toBe(false);
    try {
      assertEntitlement("free", "offlineDownload");
      throw new Error("expected assertEntitlement to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(402);
      expect((e as HttpError).code).toBe("PAYWALL_REQUIRED");
    }
  });

  it("allows pro and lifetime users to use a Pro-only feature", () => {
    expect(() => assertEntitlement("pro", "offlineDownload")).not.toThrow();
    expect(() => assertEntitlement("lifetime", "offlineDownload")).not.toThrow();
  });

  it("advancedStats is Pro-only, so a free user is blocked at the entitlement", () => {
    expect(getLimitsForTier("free").advancedStats).toBe(false);
    expect(() => assertEntitlement("free", "advancedStats")).toThrow(HttpError);
    expect(() => assertEntitlement("pro", "advancedStats")).not.toThrow();
  });
});

describe("advanced-stats window clamping (#235)", () => {
  it("clamps a free user's 30-day request down to the basic 7-day window", () => {
    expect(effectiveStatsWindowDays("free", 30)).toBe(7);
  });

  it("leaves a free user's 7-day request untouched", () => {
    expect(effectiveStatsWindowDays("free", 7)).toBe(7);
  });

  it("lets pro and lifetime users keep the full 30-day window", () => {
    expect(effectiveStatsWindowDays("pro", 30)).toBe(30);
    expect(effectiveStatsWindowDays("lifetime", 30)).toBe(30);
  });
});
