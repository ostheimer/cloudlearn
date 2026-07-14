import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/http";
import type { DeckRecord } from "@/lib/db";

// #235: Offline download (deck export + Anki export) is a Pro entitlement.
// These tests pin the server-side gate: a free user is rejected with
// 402/PAYWALL_REQUIRED before any card data is read, while a Pro user passes.

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

import { exportDeckForOffline } from "@/services/deckService";
import { exportDeckAsApkg } from "@/services/ankiExportService";

const userId = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";
const deckId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const deck: DeckRecord = {
  id: deckId,
  userId,
  title: "Biologie",
  tags: ["bio"],
  createdAt: "2026-07-08T10:00:00.000Z",
  updatedAt: "2026-07-08T10:00:00.000Z",
};

function mockTier(tier: "free" | "pro" | "lifetime") {
  subscriptionMocks.getSubscriptionStatus.mockResolvedValue({
    userId,
    tier,
    isActive: tier !== "free",
    expiresAt: null,
  });
}

describe("offline download entitlement (#235)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getDeck.mockResolvedValue(deck);
    dbMocks.listCardsForDeck.mockResolvedValue([]);
  });

  it("blocks a free user from exporting a deck for offline use", async () => {
    mockTier("free");

    await expect(exportDeckForOffline(userId, deckId)).rejects.toMatchObject({
      status: 402,
      code: "PAYWALL_REQUIRED",
    } satisfies Partial<HttpError>);

    // Rejected before touching card data.
    expect(dbMocks.listCardsForDeck).not.toHaveBeenCalled();
  });

  it("blocks a free user from the Anki export", async () => {
    mockTier("free");

    await expect(exportDeckAsApkg(userId, deckId)).rejects.toMatchObject({
      status: 402,
      code: "PAYWALL_REQUIRED",
    } satisfies Partial<HttpError>);

    expect(dbMocks.listCardsForDeck).not.toHaveBeenCalled();
  });

  it("allows a pro user to export a deck for offline use", async () => {
    mockTier("pro");

    const result = await exportDeckForOffline(userId, deckId);
    expect(result.deck).toEqual(deck);
    expect(dbMocks.listCardsForDeck).toHaveBeenCalledWith(userId, deckId);
  });

  it("allows a lifetime user to run the Anki export", async () => {
    mockTier("lifetime");

    const result = await exportDeckAsApkg(userId, deckId);
    expect(result.fileName).toBe(`${deckId}.apkg`);
    expect(dbMocks.listCardsForDeck).toHaveBeenCalledWith(userId, deckId);
  });
});
