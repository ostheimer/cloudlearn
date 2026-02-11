import { beforeEach, describe, expect, it } from "vitest";
import { createDeckForUser, listCardsInDeck, listDecksForUser } from "@/services/deckService";
import { processScan } from "@/services/scanService";
import { storeReview } from "@/services/reviewService";
import { syncOperations } from "@/services/syncService";
import { createSignedUploadUrl, isSignedUrlExpired } from "@/lib/r2";
import { resetStore, updateCardFsrs } from "@/lib/inMemoryStore";
import { resetIdempotencyStore } from "@/lib/idempotencyStore";
import { checkRateLimit, resetRateLimitStore } from "@/lib/rateLimit";
import { getDueCards } from "@/services/learnService";

const userId = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";

describe("api services", () => {
  beforeEach(() => {
    resetStore();
    resetIdempotencyStore();
    resetRateLimitStore();
  });

  it("processes scans idempotently", () => {
    const deck = createDeckForUser({ userId, title: "Biologie", tags: ["schule"] });
    const payload = {
      userId,
      extractedText: "Photosynthese wandelt Licht in chemische Energie um.",
      sourceLanguage: "de",
      idempotencyKey: "scan-key-0001",
      deckId: deck.id
    };

    const first = processScan(payload, "req-1");
    const second = processScan(payload, "req-1");

    expect(first.cards.length).toBeGreaterThan(0);
    expect(second.cards).toEqual(first.cards);
    expect(listCardsInDeck(userId, deck.id).length).toBe(first.cards.length);
  });

  it("uses fallback model when primary fails", () => {
    const deck = createDeckForUser({ userId, title: "Fallback", tags: [] });
    const result = processScan(
      {
        userId,
        extractedText: "[force-fallback] Dieselbe Aussage bleibt lernbar.",
        sourceLanguage: "de",
        idempotencyKey: "scan-key-fallback-001",
        deckId: deck.id
      },
      "req-fallback"
    );

    expect(result.fallbackUsed).toBe(true);
    expect(result.model).toBe("gpt-4o-mini-fallback");
  });

  it("stores reviews and returns next due date", () => {
    const deck = createDeckForUser({ userId, title: "Chemie", tags: ["schule"] });
    const scan = processScan(
      {
        userId,
        extractedText: "Ein Atom besteht aus Protonen, Neutronen und Elektronen.",
        sourceLanguage: "de",
        idempotencyKey: "scan-key-0002",
        deckId: deck.id
      },
      "req-2"
    );

    const cards = listCardsInDeck(userId, deck.id);
    const card = cards[0];
    expect(card).toBeDefined();

    const review = storeReview(
      {
        userId,
        cardId: card!.id,
        rating: "good",
        reviewedAt: "2026-02-09T10:00:00.000Z",
        idempotencyKey: "review-key-0001"
      },
      "req-3"
    );

    expect(review.cardId).toBe(card!.id);
    expect(new Date(review.nextDueAt).getTime()).toBeGreaterThan(new Date("2026-02-09T10:00:00.000Z").getTime());
    expect(scan.cards.length).toBeGreaterThan(0);
  });

  it("syncs review operations and rejects invalid payloads", () => {
    const deck = createDeckForUser({ userId, title: "Physik", tags: [] });
    processScan(
      {
        userId,
        extractedText: "Kraft ist Masse mal Beschleunigung.",
        sourceLanguage: "de",
        idempotencyKey: "scan-key-0003",
        deckId: deck.id
      },
      "req-4"
    );
    const card = listCardsInDeck(userId, deck.id)[0];
    if (!card) {
      throw new Error("Expected card to exist after scan");
    }

    const synced = syncOperations(
      {
        userId,
        operations: [
          {
            operationId: "operation-ok-001",
            operationType: "review",
            createdAt: "2026-02-09T10:00:00.000Z",
            payload: {
              userId,
              cardId: card.id,
              rating: "easy",
              reviewedAt: "2026-02-09T10:00:00.000Z",
              idempotencyKey: "review-sync-0001"
            }
          }
        ]
      },
      "req-5"
    );

    expect(synced.acceptedOperationIds).toContain("operation-ok-001");
    expect(synced.rejectedOperationIds).toHaveLength(0);
  });

  it("returns only due cards sorted by due date", () => {
    const deck = createDeckForUser({ userId, title: "Due Queue", tags: [] });
    processScan(
      {
        userId,
        extractedText: "Definition eins. Definition zwei.",
        sourceLanguage: "de",
        idempotencyKey: "scan-key-due-001",
        deckId: deck.id
      },
      "req-due"
    );
    const cards = listCardsInDeck(userId, deck.id);
    if (cards.length < 2) {
      throw new Error("Expected at least two cards");
    }
    const dueCard = cards[0];
    const futureCard = cards[1];
    if (!dueCard || !futureCard) {
      throw new Error("Expected due and future card");
    }

    const now = new Date("2026-02-09T12:00:00.000Z");
    updateCardFsrs(dueCard.id, {
      fsrsDue: new Date(now.getTime() - 60_000).toISOString(),
      fsrsStability: 1,
      fsrsDifficulty: 1,
      fsrsState: "review"
    });
    updateCardFsrs(futureCard.id, {
      fsrsDue: new Date(now.getTime() + 60_000).toISOString(),
      fsrsStability: 1,
      fsrsDifficulty: 1,
      fsrsState: "review"
    });

    const due = getDueCards(userId, now.toISOString());
    expect(due.map((item) => item.id)).toContain(dueCard.id);
    expect(due.map((item) => item.id)).not.toContain(futureCard.id);
  });

  it("handles sync replay idempotently", () => {
    const deck = createDeckForUser({ userId, title: "Sync Replay", tags: [] });
    processScan(
      {
        userId,
        extractedText: "Wiederholung ist wichtig.",
        sourceLanguage: "de",
        idempotencyKey: "scan-key-sync-001",
        deckId: deck.id
      },
      "req-sync-1"
    );
    const card = listCardsInDeck(userId, deck.id)[0];
    if (!card) {
      throw new Error("Expected card for sync replay test");
    }

    const payload = {
      userId,
      operations: [
        {
          operationId: "operation-replay-001",
          operationType: "review",
          createdAt: "2026-02-09T10:00:00.000Z",
          payload: {
            userId,
            cardId: card.id,
            rating: "good",
            reviewedAt: "2026-02-09T10:00:00.000Z",
            idempotencyKey: "review-replay-001"
          }
        }
      ]
    };

    const first = syncOperations(payload, "req-sync-2");
    const second = syncOperations(payload, "req-sync-3");

    expect(first.acceptedOperationIds).toContain("operation-replay-001");
    expect(second.acceptedOperationIds).toContain("operation-replay-001");
  });

  it("creates expiring signed upload URLs", () => {
    const signed = createSignedUploadUrl(`${userId}/image.png`, "image/png");
    const expires = Number(new URL(signed.url).searchParams.get("expires"));

    expect(signed.url).toContain("signature=");
    expect(expires).toBeGreaterThan(Date.now());
    expect(isSignedUrlExpired(expires - 10, expires)).toBe(true);
  });

  it("applies per-minute rate limits", () => {
    const key = `${userId}:free`;
    const now = Date.now();
    expect(checkRateLimit(key, 2, now)).toBe(true);
    expect(checkRateLimit(key, 2, now + 1)).toBe(true);
    expect(checkRateLimit(key, 2, now + 2)).toBe(false);
  });

  it("isolates decks by user boundary", () => {
    const otherUserId = "0b25d170-8d32-47f0-9e4a-5631161fb2b4";
    createDeckForUser({ userId, title: "Eigene Decks", tags: [] });
    createDeckForUser({ userId: otherUserId, title: "Fremdes Deck", tags: [] });

    const ownDecks = listDecksForUser(userId);
    const foreignDecks = listDecksForUser(otherUserId);

    expect(ownDecks).toHaveLength(1);
    expect(foreignDecks).toHaveLength(1);
    expect(ownDecks[0]?.title).toBe("Eigene Decks");
    expect(foreignDecks[0]?.title).toBe("Fremdes Deck");
  });
});
