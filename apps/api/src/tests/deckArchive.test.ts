import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLimitsForTier } from "@/lib/featureGates";

const dbMocks = vi.hoisted(() => ({
  countCardsInDeck: vi.fn(),
  createDeck: vi.fn(),
  countUserDecks: vi.fn(),
  listDecks: vi.fn(),
  setDeckArchived: vi.fn(),
  listCardsForDeck: vi.fn(),
  softDeleteDeck: vi.fn(),
  updateDeck: vi.fn(),
  getDeck: vi.fn(),
  duplicateDeck: vi.fn(),
  setDeckShareToken: vi.fn(),
  getDeckShareToken: vi.fn(),
  clearDeckShareToken: vi.fn(),
  getDeckByShareToken: vi.fn(),
  getDeckWithCardCount: vi.fn(),
  listFoldersForDeck: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ ...dbMocks }));
vi.mock("@/services/subscriptionService", () => ({
  getSubscriptionStatus: vi.fn(async () => ({ tier: "free" })),
}));

import {
  createDeckForUser,
  listDecksForUser,
  setDeckArchivedForUser,
} from "@/services/deckService";

const USER_ID = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";
const DECK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.setDeckArchived.mockResolvedValue({ id: DECK_ID, title: "Chemie" });
  dbMocks.countUserDecks.mockResolvedValue(3);
  dbMocks.createDeck.mockResolvedValue({ id: "neu", title: "Neu" });
});

describe("Deck archivieren (#614)", () => {
  it("archiviert und holt über dieselbe Funktion zurück", async () => {
    await setDeckArchivedForUser(USER_ID, DECK_ID, true);
    expect(dbMocks.setDeckArchived).toHaveBeenCalledWith(DECK_ID, USER_ID, true);

    await setDeckArchivedForUser(USER_ID, DECK_ID, false);
    expect(dbMocks.setDeckArchived).toHaveBeenLastCalledWith(DECK_ID, USER_ID, false);
  });

  it("meldet ein fremdes oder fehlendes Deck als 404", async () => {
    dbMocks.setDeckArchived.mockResolvedValue(null);
    await expect(setDeckArchivedForUser(USER_ID, DECK_ID, true)).rejects.toMatchObject({
      code: "DECK_NOT_FOUND",
      status: 404,
    });
  });

  it("reicht die Archiv-Auswahl an die Datenbank durch", async () => {
    dbMocks.listDecks.mockResolvedValue([]);
    await listDecksForUser(USER_ID);
    expect(dbMocks.listDecks).toHaveBeenLastCalledWith(USER_ID, {});

    await listDecksForUser(USER_ID, { archived: true });
    expect(dbMocks.listDecks).toHaveBeenLastCalledWith(USER_ID, { archived: true });
  });

  it("zählt archivierte Decks gegen die Deck-Grenze", async () => {
    // Der Kern: Archivieren darf kein Weg um die Tarif-Grenze sein. Gezählt
    // wird über countUserDecks (alle nicht gelöschten), NICHT über listDecks
    // (seit #614 nur die aktiven) — sonst könnte man archivieren, neu anlegen
    // und das beliebig oft wiederholen.
    dbMocks.countUserDecks.mockResolvedValue(getLimitsForTier("free").maxDecks);

    await expect(
      createDeckForUser({ userId: USER_ID, title: "Noch eins", tags: [] })
    ).rejects.toMatchObject({ code: "DECK_LIMIT_REACHED" });

    expect(dbMocks.countUserDecks).toHaveBeenCalledWith(USER_ID);
    expect(dbMocks.listDecks).not.toHaveBeenCalled();
    expect(dbMocks.createDeck).not.toHaveBeenCalled();
  });

  it("lässt ein Deck anlegen, solange Platz ist", async () => {
    dbMocks.countUserDecks.mockResolvedValue(getLimitsForTier("free").maxDecks - 1);
    await expect(
      createDeckForUser({ userId: USER_ID, title: "Noch eins", tags: [] })
    ).resolves.toBeTruthy();
    expect(dbMocks.createDeck).toHaveBeenCalled();
  });
});
