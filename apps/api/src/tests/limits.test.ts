import { describe, it, expect } from "vitest";
import { assertDeckLimit, assertCardLimit } from "../lib/limits";
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
