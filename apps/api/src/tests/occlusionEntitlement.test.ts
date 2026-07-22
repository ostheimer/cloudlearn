import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/http";
import type { CardRecord, DeckRecord } from "@/lib/db";

// Image occlusion ("Bild-Abdecken") is advertised as a Pro benefit on the
// paywall but was gated nowhere, so a free account could create occlusion cards
// for free. These tests pin the server-side gate:
//   * creating an occlusion card  -> 402/PAYWALL_REQUIRED for free tiers
//   * turning a card INTO one     -> same gate (create-then-PATCH loophole)
//   * every other card type       -> untouched for every tier
//   * reading/reviewing EXISTING occlusion cards -> stays open for free users,
//     so a downgrade never locks anyone out of their own cards.

const dbMocks = vi.hoisted(() => ({
  createCard: vi.fn(),
  getDeck: vi.fn(),
  listCardsForDeck: vi.fn(),
  softDeleteCard: vi.fn(),
  updateCard: vi.fn(),
  createDeck: vi.fn(),
  listDecks: vi.fn(),
  softDeleteDeck: vi.fn(),
  updateDeck: vi.fn(),
  duplicateDeck: vi.fn(),
  setDeckShareToken: vi.fn(),
  getDeckShareToken: vi.fn(),
  getDeckByShareToken: vi.fn(),
  getDeckWithCardCount: vi.fn(),
  listFoldersForDeck: vi.fn(),
  createReview: vi.fn(),
  findReviewByIdempotencyKey: vi.fn(),
  getCard: vi.fn(),
  markFriendStreakDay: vi.fn(),
  updateCardFsrs: vi.fn(),
  updateStreakAfterReview: vi.fn(),
}));

const subscriptionMocks = vi.hoisted(() => ({
  getSubscriptionStatus: vi.fn(),
}));

vi.mock("@/lib/db", () => dbMocks);

vi.mock("@/services/subscriptionService", () => ({
  getSubscriptionStatus: subscriptionMocks.getSubscriptionStatus,
}));

import { createCardForUser, updateCardForUser } from "@/services/cardService";
import { listCardsInDeck } from "@/services/deckService";
import { storeReview } from "@/services/reviewService";

const userId = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";
const deckId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const cardId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const deck: DeckRecord = {
  id: deckId,
  userId,
  title: "Anatomie",
  tags: ["bio"],
  createdAt: "2026-07-16T10:00:00.000Z",
  updatedAt: "2026-07-16T10:00:00.000Z",
};

const occlusionCard = {
  front: "Bild-Occlusion: Was ist an der markierten Stelle?",
  back: "Bereich 1",
  type: "occlusion" as const,
  difficulty: "medium" as const,
  tags: [] as string[],
  sourceImageUrl: `${userId}/1752660000000-schaedel.png`,
  extraData: { regions: [{ x: 0.1, y: 0.1, w: 0.2, h: 0.2, label: "Bereich 1" }], hideIndex: 0 },
};

const basicCard = {
  front: "Was ist 2+2?",
  back: "4",
  type: "basic" as const,
  difficulty: "easy" as const,
  tags: [] as string[],
};

const storedOcclusionCard: CardRecord = {
  ...occlusionCard,
  id: cardId,
  userId,
  deckId,
  starred: false,
  fsrsDue: "2026-07-16T10:00:00.000Z",
  fsrsStability: 0,
  fsrsDifficulty: 0,
  fsrsState: "new",
  fsrsReps: 0,
  fsrsLapses: 0,
  fsrsElapsedDays: 0,
  fsrsScheduledDays: 0,
  fsrsLearningSteps: 0,
  fsrsLastReview: null,
};

type Tier = "free" | "pro" | "lifetime";

function mockTier(tier: Tier) {
  subscriptionMocks.getSubscriptionStatus.mockResolvedValue({
    userId,
    tier,
    isActive: tier !== "free",
    expiresAt: null,
  });
}

const paywall = { status: 402, code: "PAYWALL_REQUIRED" } satisfies Partial<HttpError>;

describe("image occlusion entitlement (#235)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getDeck.mockResolvedValue(deck);
    dbMocks.listCardsForDeck.mockResolvedValue([]);
    dbMocks.createCard.mockImplementation(
      async (_userId: string, _deckId: string, card: Record<string, unknown>) => ({
        ...storedOcclusionCard,
        ...card,
      }),
    );
    dbMocks.updateCard.mockImplementation(
      async (_cardId: string, _userId: string, updates: Record<string, unknown>) => ({
        ...storedOcclusionCard,
        ...updates,
      }),
    );
  });

  describe("creating", () => {
    it("blocks a free user from creating an occlusion card", async () => {
      mockTier("free");

      await expect(
        createCardForUser({ userId, deckId, card: occlusionCard }),
      ).rejects.toMatchObject(paywall);

      expect(dbMocks.createCard).not.toHaveBeenCalled();
      // Rejected before touching card data, like the sibling entitlement gates.
      expect(dbMocks.listCardsForDeck).not.toHaveBeenCalled();
    });

    it("rejects the free user with the shared Pro-upgrade message", async () => {
      mockTier("free");

      await expect(
        createCardForUser({ userId, deckId, card: occlusionCard }),
      ).rejects.toThrow("This feature requires Pro. Upgrade to unlock it.");
    });

    it.each<Tier>(["pro", "lifetime"])(
      "lets a %s user create an occlusion card normally",
      async (tier) => {
        mockTier(tier);

        const card = await createCardForUser({ userId, deckId, card: occlusionCard });

        expect(card.type).toBe("occlusion");
        expect(dbMocks.createCard).toHaveBeenCalledWith(userId, deckId, occlusionCard);
      },
    );

    it.each<Tier>(["free", "pro", "lifetime"])(
      "leaves normal card types unaffected for a %s user",
      async (tier) => {
        mockTier(tier);

        for (const type of ["basic", "cloze", "mcq", "matching"] as const) {
          dbMocks.createCard.mockClear();
          const card = await createCardForUser({
            userId,
            deckId,
            card: { ...basicCard, type },
          });

          expect(card.type).toBe(type);
          expect(dbMocks.createCard).toHaveBeenCalledTimes(1);
        }
      },
    );
  });

  describe("editing into an occlusion card", () => {
    it("blocks a free user from turning an existing card into an occlusion card", async () => {
      mockTier("free");

      await expect(
        updateCardForUser({ userId, cardId, type: "occlusion" }),
      ).rejects.toMatchObject(paywall);

      expect(dbMocks.updateCard).not.toHaveBeenCalled();
    });

    it.each<Tier>(["pro", "lifetime"])(
      "lets a %s user turn a card into an occlusion card",
      async (tier) => {
        mockTier(tier);

        const card = await updateCardForUser({ userId, cardId, type: "occlusion" });

        expect(card?.type).toBe("occlusion");
        expect(dbMocks.updateCard).toHaveBeenCalledWith(cardId, userId, {
          type: "occlusion",
        });
      },
    );

    it("does not gate edits to other card types for a free user", async () => {
      mockTier("free");
      // A basic/cloze type is re-derived from the card text, so the service
      // reads the card first (cardTypeDerivation.test.ts pins that logic).
      dbMocks.getCard.mockResolvedValue({ ...storedOcclusionCard, ...basicCard });

      const card = await updateCardForUser({ userId, cardId, type: "basic" });

      expect(card?.type).toBe("basic");
      expect(dbMocks.updateCard).toHaveBeenCalledWith(cardId, userId, { type: "basic" });
    });

    it("never reaches the paywall for a PATCH that does not send a type", async () => {
      mockTier("free");

      // #355 made absent keys stay `undefined` instead of defaulting to "basic".
      // The gate keys off `parsed.type`, so a plain star must not touch the
      // paywall — nor even cost a subscription lookup — and must not smuggle a
      // type into the update (which would downgrade an occlusion card).
      await updateCardForUser({ userId, cardId, starred: true });

      expect(dbMocks.updateCard).toHaveBeenCalledWith(cardId, userId, { starred: true });
      expect(subscriptionMocks.getSubscriptionStatus).not.toHaveBeenCalled();
    });
  });

  describe("existing occlusion cards stay open for free users", () => {
    it("still lists an occlusion card for a free user", async () => {
      mockTier("free");
      dbMocks.listCardsForDeck.mockResolvedValue([storedOcclusionCard]);

      const cards = await listCardsInDeck(userId, deckId);

      expect(cards).toEqual([storedOcclusionCard]);
      // The read path must not consult the paywall at all.
      expect(subscriptionMocks.getSubscriptionStatus).not.toHaveBeenCalled();
    });

    it("still lets a free user edit the text of an existing occlusion card", async () => {
      mockTier("free");

      // Text-only edit: no type is sent, so the gate stays out of the way and
      // the card keeps its occlusion type (#355 — the update no longer fills in
      // a default type).
      const card = await updateCardForUser({ userId, cardId, back: "Stirnbein" });

      expect(card?.back).toBe("Stirnbein");
      expect(dbMocks.updateCard).toHaveBeenCalledWith(cardId, userId, { back: "Stirnbein" });
      expect(subscriptionMocks.getSubscriptionStatus).not.toHaveBeenCalled();
    });

    it("still lets a free user review an existing occlusion card", async () => {
      mockTier("free");
      dbMocks.findReviewByIdempotencyKey.mockResolvedValue(null);
      dbMocks.getCard.mockResolvedValue(storedOcclusionCard);
      dbMocks.createReview.mockResolvedValue(undefined);
      dbMocks.updateStreakAfterReview.mockResolvedValue(undefined);
      dbMocks.markFriendStreakDay.mockResolvedValue(undefined);
      dbMocks.updateCardFsrs.mockImplementation(
        async (_cardId: string, _userId: string, fsrs: Record<string, unknown>) => ({
          ...storedOcclusionCard,
          ...fsrs,
        }),
      );

      const result = await storeReview(
        {
          userId,
          cardId,
          rating: "good",
          reviewedAt: "2026-07-16T12:00:00.000Z",
          idempotencyKey: "occlusion-review-1",
        },
        "req-occlusion-1",
      );

      expect(result.cardId).toBe(cardId);
      expect(dbMocks.createReview).toHaveBeenCalled();
      expect(subscriptionMocks.getSubscriptionStatus).not.toHaveBeenCalled();
    });
  });
});
