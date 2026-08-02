import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLimitsForTier } from "@/lib/featureGates";

const dbMocks = vi.hoisted(() => ({
  getDeletedCard: vi.fn(),
  getDeletedDeck: vi.fn(),
  listCardsForDeck: vi.fn(),
  listTrash: vi.fn(),
  purgeAllTrash: vi.fn(),
  purgeTrashCard: vi.fn(),
  purgeTrashDeck: vi.fn(),
  restoreCard: vi.fn(),
  restoreDeckWithinLimit: vi.fn(),
}));

const subscriptionMocks = vi.hoisted(() => ({ getSubscriptionStatus: vi.fn() }));

vi.mock("@/lib/db", () => ({ ...dbMocks }));
vi.mock("@/services/subscriptionService", () => ({
  getSubscriptionStatus: subscriptionMocks.getSubscriptionStatus,
}));

import { restoreCardForUser, restoreDeckForUser } from "@/services/trashService";

const USER_ID = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";
const DECK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CARD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

beforeEach(() => {
  vi.clearAllMocks();
  subscriptionMocks.getSubscriptionStatus.mockResolvedValue({ tier: "free" });
  dbMocks.getDeletedDeck.mockResolvedValue({
    id: DECK_ID,
    title: "Waidmannssprache",
    deletedAt: "2026-07-09T12:00:00.000Z",
  });
  dbMocks.restoreDeckWithinLimit.mockResolvedValue("restored");
  dbMocks.restoreCard.mockResolvedValue(true);
});

describe("restoreDeckForUser", () => {
  it("holt das Deck zurück, wenn im Tarif Platz ist", async () => {
    expect(await restoreDeckForUser(USER_ID, DECK_ID)).toBe(true);
    expect(dbMocks.restoreDeckWithinLimit).toHaveBeenCalledWith(
      DECK_ID,
      USER_ID,
      getLimitsForTier("free").maxDecks
    );
  });

  it("lehnt ehrlich ab, wenn die atomare Wiederherstellung die Deck-Grenze erreicht", async () => {
    // Ohne diese Prüfung wäre der Papierkorb ein Weg um die Tarifgrenze:
    // löschen, neu anlegen, alles zurückholen (#611 — ablehnen statt kappen).
    dbMocks.restoreDeckWithinLimit.mockResolvedValue("limit_reached");

    await expect(restoreDeckForUser(USER_ID, DECK_ID)).rejects.toMatchObject({
      code: "DECK_LIMIT_REACHED",
    });
    expect(dbMocks.restoreDeckWithinLimit).toHaveBeenCalledOnce();
  });

  it("meldet ein Deck, das nicht im Papierkorb liegt, ohne Limit-Abfrage", async () => {
    dbMocks.getDeletedDeck.mockResolvedValue(null);
    expect(await restoreDeckForUser(USER_ID, DECK_ID)).toBe(false);
    expect(subscriptionMocks.getSubscriptionStatus).not.toHaveBeenCalled();
  });
});

describe("restoreCardForUser", () => {
  it("holt die Karte zurück, wenn ihr Deck lebt und Platz hat", async () => {
    dbMocks.getDeletedCard.mockResolvedValue({
      id: CARD_ID,
      deckId: DECK_ID,
      deckDeleted: false,
    });
    dbMocks.listCardsForDeck.mockResolvedValue([{ id: "x" }]);

    expect(await restoreCardForUser(USER_ID, CARD_ID)).toBe(true);
    expect(dbMocks.restoreCard).toHaveBeenCalledWith(CARD_ID, USER_ID);
  });

  it("erklärt, dass erst das Deck zurück muss", async () => {
    // Eine Karte in einem gelöschten Deck zurückzuholen würde sie unsichtbar
    // machen (alle Leser joinen auf lebende Decks) — also klare Auskunft
    // statt eines stillen Erfolgs, der nichts sichtbar macht.
    dbMocks.getDeletedCard.mockResolvedValue({
      id: CARD_ID,
      deckId: DECK_ID,
      deckDeleted: true,
    });

    await expect(restoreCardForUser(USER_ID, CARD_ID)).rejects.toMatchObject({
      code: "DECK_IN_TRASH",
      status: 409,
    });
    expect(dbMocks.restoreCard).not.toHaveBeenCalled();
  });

  it("lehnt ab, wenn das Deck voll ist", async () => {
    dbMocks.getDeletedCard.mockResolvedValue({
      id: CARD_ID,
      deckId: DECK_ID,
      deckDeleted: false,
    });
    dbMocks.listCardsForDeck.mockResolvedValue(
      Array.from({ length: getLimitsForTier("free").maxCardsPerDeck }, (_, i) => ({ id: `c${i}` }))
    );

    await expect(restoreCardForUser(USER_ID, CARD_ID)).rejects.toMatchObject({
      code: "DECK_FULL",
    });
    expect(dbMocks.restoreCard).not.toHaveBeenCalled();
  });
});
