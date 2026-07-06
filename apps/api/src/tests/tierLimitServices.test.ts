import { beforeEach, describe, expect, it, vi } from "vitest";
import { TIER_LIMITS } from "@/lib/featureGates";
import { createCardForUser } from "@/services/cardService";
import { createDeckForUser } from "@/services/deckService";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import {
  countCardsInDeck,
  countUserDecks,
  createCard,
  createDeck,
  getDeck,
} from "@/lib/db";

vi.mock("@/services/subscriptionService", () => ({
  getSubscriptionStatus: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  countCardsInDeck: vi.fn(),
  countUserDecks: vi.fn(),
  createCard: vi.fn(),
  createDeck: vi.fn(),
  duplicateDeck: vi.fn(),
  getDeck: vi.fn(),
  getDeckByShareToken: vi.fn(),
  getDeckWithCardCount: vi.fn(),
  listCardsForDeck: vi.fn(),
  listCoursesForDeck: vi.fn(),
  listDecks: vi.fn(),
  listFoldersForDeck: vi.fn(),
  setDeckShareToken: vi.fn(),
  softDeleteCard: vi.fn(),
  softDeleteDeck: vi.fn(),
  updateCard: vi.fn(),
  updateDeck: vi.fn(),
}));

const userId = "11111111-1111-4111-8111-111111111111";
const deckId = "22222222-2222-4222-8222-222222222222";
const cardInput = {
  front: "Was ist 2+2?",
  back: "4",
  type: "basic" as const,
  difficulty: "easy" as const,
  tags: ["mathe"],
};

describe("tier limit enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSubscriptionStatus).mockResolvedValue({
      userId,
      tier: "free",
      isActive: false,
      expiresAt: null,
    });
    vi.mocked(getDeck).mockResolvedValue({
      id: deckId,
      userId,
      title: "Deck",
      tags: [],
      createdAt: "2026-07-06T00:00:00.000Z",
      updatedAt: "2026-07-06T00:00:00.000Z",
    });
  });

  it("blocks deck creation when a free user has reached the deck limit", async () => {
    vi.mocked(countUserDecks).mockResolvedValue(TIER_LIMITS.free.maxDecks);

    await expect(
      createDeckForUser({
        userId,
        title: "Deck 11",
        tags: [],
      })
    ).rejects.toMatchObject({
      status: 402,
      code: "PAYWALL_REQUIRED",
    });

    expect(createDeck).not.toHaveBeenCalled();
  });

  it("allows deck creation while the user is still below the tier limit", async () => {
    vi.mocked(countUserDecks).mockResolvedValue(TIER_LIMITS.free.maxDecks - 1);
    vi.mocked(createDeck).mockResolvedValue({
      id: deckId,
      userId,
      title: "Deck 10",
      tags: [],
      createdAt: "2026-07-06T00:00:00.000Z",
      updatedAt: "2026-07-06T00:00:00.000Z",
    });

    const deck = await createDeckForUser({
      userId,
      title: "Deck 10",
      tags: [],
    });

    expect(deck.title).toBe("Deck 10");
    expect(createDeck).toHaveBeenCalledWith(userId, "Deck 10", []);
  });

  it("blocks card creation when the target deck has reached the card limit", async () => {
    vi.mocked(countCardsInDeck).mockResolvedValue(TIER_LIMITS.free.maxCardsPerDeck);

    await expect(
      createCardForUser({
        userId,
        deckId,
        card: cardInput,
      })
    ).rejects.toMatchObject({
      status: 402,
      code: "PAYWALL_REQUIRED",
    });

    expect(createCard).not.toHaveBeenCalled();
  });

  it("allows card creation while the target deck is still below the tier limit", async () => {
    vi.mocked(countCardsInDeck).mockResolvedValue(TIER_LIMITS.free.maxCardsPerDeck - 1);
    vi.mocked(createCard).mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      userId,
      deckId,
      ...cardInput,
      starred: false,
      fsrsDue: "2026-07-06T00:00:00.000Z",
      fsrsStability: 0,
      fsrsDifficulty: 0,
      fsrsState: "new",
      fsrsReps: 0,
      fsrsLapses: 0,
      fsrsElapsedDays: 0,
      fsrsScheduledDays: 0,
      fsrsLearningSteps: 0,
      fsrsLastReview: null,
      deletedAt: null,
    });

    const card = await createCardForUser({
      userId,
      deckId,
      card: cardInput,
    });

    expect(card.front).toBe("Was ist 2+2?");
    expect(createCard).toHaveBeenCalledWith(userId, deckId, cardInput);
  });
});
