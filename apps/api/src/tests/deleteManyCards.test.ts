import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  createCard: vi.fn(),
  getCard: vi.fn(),
  getDeck: vi.fn(),
  listCardsForDeck: vi.fn(),
  softDeleteCard: vi.fn(),
  softDeleteCardsByIds: vi.fn(),
  updateCard: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ ...dbMocks }));
vi.mock("@/services/subscriptionService", () => ({
  getSubscriptionStatus: vi.fn(async () => ({ tier: "free" })),
}));

import { deleteCardsForUser } from "@/services/cardService";

const USER_ID = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";
const DECK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CARD_A = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const CARD_B = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.getDeck.mockResolvedValue({ id: DECK_ID, userId: USER_ID, title: "Physik" });
  dbMocks.softDeleteCardsByIds.mockResolvedValue(2);
});

describe("deleteCardsForUser — Mehrfachauswahl (#614)", () => {
  it("löscht die Auswahl in EINEM Aufruf", async () => {
    const deleted = await deleteCardsForUser({
      userId: USER_ID,
      deckId: DECK_ID,
      cardIds: [CARD_A, CARD_B],
    });

    expect(deleted).toBe(2);
    // Eine Anfrage, nicht eine je Karte — genau das N+1-Muster, das #612 abbaut.
    expect(dbMocks.softDeleteCardsByIds).toHaveBeenCalledTimes(1);
    expect(dbMocks.softDeleteCardsByIds).toHaveBeenCalledWith(USER_ID, DECK_ID, [CARD_A, CARD_B]);
    expect(dbMocks.softDeleteCard).not.toHaveBeenCalled();
  });

  it("gibt die WIRKLICH getroffene Anzahl zurück, nicht die gesendete", async () => {
    // Eine der beiden Karten war schon gelöscht (anderes Gerät, #605). Eine zu
    // hohe Zahl zu melden wäre eine Behauptung über etwas, das nicht passierte.
    dbMocks.softDeleteCardsByIds.mockResolvedValue(1);
    await expect(
      deleteCardsForUser({ userId: USER_ID, deckId: DECK_ID, cardIds: [CARD_A, CARD_B] })
    ).resolves.toBe(1);
  });

  it("weist ein fremdes Deck ab, ohne zu löschen", async () => {
    // getDeck filtert auf user_id; ein fremdes Deck kommt hier als null an.
    dbMocks.getDeck.mockResolvedValue(null);

    await expect(
      deleteCardsForUser({ userId: USER_ID, deckId: DECK_ID, cardIds: [CARD_A] })
    ).rejects.toMatchObject({ code: "DECK_NOT_FOUND", status: 404 });
    expect(dbMocks.softDeleteCardsByIds).not.toHaveBeenCalled();
  });

  it("verlangt mindestens eine Karte", async () => {
    await expect(
      deleteCardsForUser({ userId: USER_ID, deckId: DECK_ID, cardIds: [] })
    ).rejects.toThrow();
    expect(dbMocks.softDeleteCardsByIds).not.toHaveBeenCalled();
  });

  it("lehnt eine unsinnig lange Liste ab", async () => {
    const tooMany = Array.from({ length: 2001 }, (_, i) => {
      const suffix = String(i).padStart(4, "0");
      return `cccccccc-cccc-4ccc-8ccc-cccccccc${suffix}`;
    });
    await expect(
      deleteCardsForUser({ userId: USER_ID, deckId: DECK_ID, cardIds: tooMany })
    ).rejects.toThrow();
    expect(dbMocks.softDeleteCardsByIds).not.toHaveBeenCalled();
  });
});
