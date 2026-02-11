import { describe, expect, it } from "vitest";
import { createSignedUploadUrl, isSignedUrlExpired } from "@/lib/r2";
import { checkRateLimit, resetRateLimitStore } from "@/lib/rateLimit";

// NOTE: Service tests that depend on Supabase are now integration tests.
// They require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set.
// Run with: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm test

const userId = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";

describe("api services — unit tests (no DB required)", () => {
  it("creates expiring signed upload URLs", () => {
    const signed = createSignedUploadUrl(`${userId}/image.png`, "image/png");
    const expires = Number(new URL(signed.url).searchParams.get("expires"));

    expect(signed.url).toContain("signature=");
    expect(expires).toBeGreaterThan(Date.now());
    expect(isSignedUrlExpired(expires - 10, expires)).toBe(true);
  });

  it("applies per-minute rate limits", () => {
    resetRateLimitStore();
    const key = `${userId}:free`;
    const now = Date.now();
    expect(checkRateLimit(key, 2, now)).toBe(true);
    expect(checkRateLimit(key, 2, now + 1)).toBe(true);
    expect(checkRateLimit(key, 2, now + 2)).toBe(false);
  });
});

// Integration tests — require Supabase connection
const HAS_DB =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!HAS_DB)("api services — integration tests (Supabase)", () => {
  it("creates and lists decks via DB", async () => {
    const { createDeckForUser, listDecksForUser } = await import(
      "@/services/deckService"
    );

    const deck = await createDeckForUser({
      userId,
      title: "Integration Test Deck",
      tags: ["test"],
    });
    expect(deck.title).toBe("Integration Test Deck");

    const decks = await listDecksForUser(userId);
    expect(decks.some((d) => d.id === deck.id)).toBe(true);
  });

  it("creates cards and lists them for a deck", async () => {
    const { createDeckForUser, listCardsInDeck } = await import(
      "@/services/deckService"
    );
    const { createCardForUser } = await import("@/services/cardService");

    const deck = await createDeckForUser({
      userId,
      title: "Card Test Deck",
      tags: [],
    });

    const card = await createCardForUser({
      userId,
      deckId: deck.id,
      card: {
        front: "Was ist 2+2?",
        back: "4",
        type: "basic",
        difficulty: "easy",
        tags: ["mathe"],
      },
    });
    expect(card.front).toBe("Was ist 2+2?");

    const cards = await listCardsInDeck(userId, deck.id);
    expect(cards.some((c) => c.id === card.id)).toBe(true);
  });

  it("stores reviews and updates FSRS state", async () => {
    const { createDeckForUser } = await import("@/services/deckService");
    const { createCardForUser } = await import("@/services/cardService");
    const { storeReview } = await import("@/services/reviewService");

    const deck = await createDeckForUser({
      userId,
      title: "Review Test",
      tags: [],
    });

    const card = await createCardForUser({
      userId,
      deckId: deck.id,
      card: {
        front: "Testfrage",
        back: "Testantwort",
        type: "basic",
        difficulty: "medium",
        tags: [],
      },
    });

    const review = await storeReview(
      {
        userId,
        cardId: card.id,
        rating: "good",
        reviewedAt: "2026-02-09T10:00:00.000Z",
        idempotencyKey: `review-int-${Date.now()}`,
      },
      "req-int-1"
    );

    expect(review.cardId).toBe(card.id);
    expect(
      new Date(review.nextDueAt).getTime()
    ).toBeGreaterThan(new Date("2026-02-09T10:00:00.000Z").getTime());
  });
});
