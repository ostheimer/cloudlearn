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

  it("blocks a free user at the deck limit with its OWN code (#371)", () => {
    // Was PAYWALL_REQUIRED — the same code the Pro-feature gate uses. A client
    // could only tell "deck full" from "needs Pro" by matching English text.
    try {
      assertDeckLimit("free", freeDecks);
      throw new Error("expected assertDeckLimit to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(409);
      expect((e as HttpError).code).toBe("DECK_LIMIT_REACHED");
    }
  });

  it("allows a pro user beyond the free deck limit", () => {
    expect(() => assertDeckLimit("pro", freeDecks)).not.toThrow();
  });

  it("blocks a free user at the per-deck card limit with its OWN code (#371)", () => {
    try {
      assertCardLimit("free", freeCards);
      throw new Error("expected assertCardLimit to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(409);
      expect((e as HttpError).code).toBe("DECK_FULL");
    }
  });

  it("allows a free user below the card limit", () => {
    expect(() => assertCardLimit("free", freeCards - 1)).not.toThrow();
  });

  it("offers the upgrade to a free user, because it genuinely raises the limit", () => {
    try {
      assertDeckLimit("free", freeDecks);
    } catch (e) {
      expect((e as HttpError).message).toContain("Mit Pro");
    }
    try {
      assertCardLimit("free", freeCards);
    } catch (e) {
      expect((e as HttpError).message).toContain("Mit Pro");
    }
  });

  it("does NOT offer the upgrade to someone who already has the top plan", () => {
    // The visible bug from #371: a Pro user whose deck is full was told to buy
    // Pro. Nothing above Pro raises these two limits, so the message has to
    // say "this is the maximum" instead of selling something.
    const proDecks = getLimitsForTier("pro").maxDecks;
    const proCards = getLimitsForTier("pro").maxCardsPerDeck;

    for (const tier of ["pro", "lifetime"] as const) {
      try {
        assertDeckLimit(tier, proDecks);
        throw new Error(`expected assertDeckLimit to throw for ${tier}`);
      } catch (e) {
        expect((e as HttpError).code).toBe("DECK_LIMIT_REACHED");
        expect((e as HttpError).message).not.toContain("Mit Pro");
      }

      try {
        assertCardLimit(tier, proCards);
        throw new Error(`expected assertCardLimit to throw for ${tier}`);
      } catch (e) {
        expect((e as HttpError).code).toBe("DECK_FULL");
        expect((e as HttpError).message).not.toContain("Mit Pro");
      }
    }
  });

  it("keeps the three rejections distinguishable from each other", () => {
    // The whole point of #371: three different reasons, three different codes.
    const codes = new Set<string>();
    for (const call of [
      () => assertDeckLimit("free", freeDecks),
      () => assertCardLimit("free", freeCards),
      () => assertEntitlement("free", "offlineDownload"),
    ]) {
      try {
        call();
      } catch (e) {
        codes.add((e as HttpError).code);
      }
    }
    expect(codes.size).toBe(3);
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
