import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLimitsForTier } from "@/lib/featureGates";
import { HttpError } from "@/lib/http";
import type { DeckRecord } from "@/lib/db";

const dbMocks = vi.hoisted(() => ({
  createDeck: vi.fn(),
  listDecks: vi.fn(),
  listCardsForDeck: vi.fn(),
  softDeleteDeck: vi.fn(),
  updateDeck: vi.fn(),
  getDeck: vi.fn(),
  duplicateDeck: vi.fn(),
  setDeckShareToken: vi.fn(),
  getDeckShareToken: vi.fn(),
  getDeckByShareToken: vi.fn(),
  getDeckWithCardCount: vi.fn(),
  listCoursesForDeck: vi.fn(),
  listFoldersForDeck: vi.fn(),
}));

const subscriptionMocks = vi.hoisted(() => ({
  getSubscriptionStatus: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  createDeck: dbMocks.createDeck,
  listDecks: dbMocks.listDecks,
  listCardsForDeck: dbMocks.listCardsForDeck,
  softDeleteDeck: dbMocks.softDeleteDeck,
  updateDeck: dbMocks.updateDeck,
  getDeck: dbMocks.getDeck,
  duplicateDeck: dbMocks.duplicateDeck,
  setDeckShareToken: dbMocks.setDeckShareToken,
  getDeckShareToken: dbMocks.getDeckShareToken,
  getDeckByShareToken: dbMocks.getDeckByShareToken,
  getDeckWithCardCount: dbMocks.getDeckWithCardCount,
  listCoursesForDeck: dbMocks.listCoursesForDeck,
  listFoldersForDeck: dbMocks.listFoldersForDeck,
}));

vi.mock("@/services/subscriptionService", () => ({
  getSubscriptionStatus: subscriptionMocks.getSubscriptionStatus,
}));

import { duplicateDeckForUser, importSharedDeck } from "@/services/deckService";

const userId = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";
const sourceDeckId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const sourceDeck: DeckRecord = {
  id: sourceDeckId,
  userId,
  title: "Biologie",
  tags: ["bio"],
  createdAt: "2026-07-08T10:00:00.000Z",
  updatedAt: "2026-07-08T10:00:00.000Z",
};

function existingDecks(count: number): DeckRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    ...sourceDeck,
    id: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
  }));
}

describe("deckService plan limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscriptionMocks.getSubscriptionStatus.mockResolvedValue({
      userId,
      tier: "free",
      isActive: false,
      expiresAt: null,
    });
  });

  it("blocks duplicating a deck when the user is at the deck limit", async () => {
    dbMocks.getDeck.mockResolvedValue(sourceDeck);
    dbMocks.listDecks.mockResolvedValue(existingDecks(getLimitsForTier("free").maxDecks));

    await expect(duplicateDeckForUser(userId, sourceDeckId)).rejects.toMatchObject({
      status: 402,
      code: "PAYWALL_REQUIRED",
    } satisfies Partial<HttpError>);

    expect(dbMocks.duplicateDeck).not.toHaveBeenCalled();
  });

  it("blocks importing a shared deck when the user is at the deck limit", async () => {
    dbMocks.getDeckByShareToken.mockResolvedValue(sourceDeck);
    dbMocks.listDecks.mockResolvedValue(existingDecks(getLimitsForTier("free").maxDecks));

    await expect(importSharedDeck(userId, "share-token")).rejects.toMatchObject({
      status: 402,
      code: "PAYWALL_REQUIRED",
    } satisfies Partial<HttpError>);

    expect(dbMocks.duplicateDeck).not.toHaveBeenCalled();
  });
});
