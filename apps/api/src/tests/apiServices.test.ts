import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/rateLimit";

// NOTE: Service tests that depend on Supabase are now integration tests.
// They require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set.
// Run with: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm test

const userId = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";

// The R2 signed-upload helper used to be covered here. It was removed with
// POST /api/v1/upload/sign in #425: no client ever called the route, every
// R2_* setting was optional, the real image upload runs through Supabase
// Storage, and the "signature" was a custom HMAC, not an S3 SigV4 presign.

describe("api services — unit tests (no DB required)", () => {
  it("fails open on rate limiting when Supabase is unavailable", async () => {
    // Rate-limit state now lives in Postgres (the check_rate_limit RPC), so this
    // is no longer an in-memory unit. With no DB client configured — or on any
    // RPC error — checkRateLimit fails OPEN (returns true) so a transient DB
    // issue never locks out real users. Real per-window enforcement is exercised
    // by the SQL migration tests against a live Postgres.
    const key = `${userId}:free`;
    expect(await checkRateLimit(key, 2)).toBe(true);
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
