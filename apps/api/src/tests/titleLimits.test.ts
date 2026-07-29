/**
 * Titel-Grenzen für Decks und Ordner (#612).
 *
 * Vorher hatten die Schemata nur `.min(1)` — tausende Zeichen liessen sich als
 * Titel speichern und sprengten jede Liste, und "   " galt als gültiger Name.
 * Jetzt: trimmen, dann 1–120 Zeichen (TITLE_MAX; die Beschreibung behält ihre
 * eigenen 500). Die Clients stoppen die Eingabe beim selben Wert, dieser Test
 * hält die Servergrenze fest — nie dem Client vertrauen.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { TITLE_MAX } from "@/lib/limits";

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
  listFoldersForDeck: vi.fn(),
  createFolder: vi.fn(),
  listFolders: vi.fn(),
  getFolder: vi.fn(),
  updateFolder: vi.fn(),
  deleteFolder: vi.fn(),
  addDeckToFolder: vi.fn(),
  removeDeckFromFolder: vi.fn(),
  listDecksInFolder: vi.fn(),
  setFolderDeckOrder: vi.fn(),
}));

const subscriptionMocks = vi.hoisted(() => ({
  getSubscriptionStatus: vi.fn(),
}));

vi.mock("@/lib/db", () => dbMocks);
vi.mock("@/services/subscriptionService", () => ({
  getSubscriptionStatus: subscriptionMocks.getSubscriptionStatus,
}));

import { createDeckForUser, updateDeckForUser } from "@/services/deckService";
import { createFolderForUser, updateFolderForUser } from "@/services/folderService";

const userId = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";
const entityId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

beforeEach(() => {
  vi.clearAllMocks();
  subscriptionMocks.getSubscriptionStatus.mockResolvedValue({ tier: "free" });
  dbMocks.listDecks.mockResolvedValue([]);
  dbMocks.createDeck.mockResolvedValue({ id: entityId });
  dbMocks.updateDeck.mockResolvedValue({ id: entityId });
  dbMocks.createFolder.mockResolvedValue({ id: entityId });
  dbMocks.updateFolder.mockResolvedValue({ id: entityId });
});

describe("Deck-Titel — 1 bis 120 Zeichen, getrimmt (#612)", () => {
  it("nimmt einen Titel mit exakt TITLE_MAX Zeichen an", async () => {
    await createDeckForUser({ userId, title: "a".repeat(TITLE_MAX), tags: [] });
    expect(dbMocks.createDeck).toHaveBeenCalledWith(userId, "a".repeat(TITLE_MAX), []);
  });

  it("weist einen Titel mit TITLE_MAX + 1 Zeichen ab", async () => {
    await expect(
      createDeckForUser({ userId, title: "a".repeat(TITLE_MAX + 1), tags: [] })
    ).rejects.toThrow();
    expect(dbMocks.createDeck).not.toHaveBeenCalled();
  });

  it("trimmt Randleerraum, statt ihn mitzuzählen oder zu speichern", async () => {
    await createDeckForUser({ userId, title: "  Biologie  ", tags: [] });
    expect(dbMocks.createDeck).toHaveBeenCalledWith(userId, "Biologie", []);
  });

  it("weist einen Titel aus nur Leerraum ab", async () => {
    await expect(createDeckForUser({ userId, title: "   ", tags: [] })).rejects.toThrow();
    expect(dbMocks.createDeck).not.toHaveBeenCalled();
  });

  it("deckelt auch das Umbenennen", async () => {
    await expect(
      updateDeckForUser({ userId, deckId: entityId, title: "a".repeat(TITLE_MAX + 1) })
    ).rejects.toThrow();
    expect(dbMocks.updateDeck).not.toHaveBeenCalled();
  });

  it("lässt ein Update ohne Titel unangetastet durch", async () => {
    await updateDeckForUser({ userId, deckId: entityId, tags: ["bio"] });
    expect(dbMocks.updateDeck).toHaveBeenCalledWith(entityId, userId, { tags: ["bio"] });
  });
});

describe("Ordner-Titel — gleiche Grenze wie Decks (#612)", () => {
  it("nimmt einen Titel mit exakt TITLE_MAX Zeichen an", async () => {
    await createFolderForUser({ userId, title: "b".repeat(TITLE_MAX) });
    expect(dbMocks.createFolder).toHaveBeenCalled();
  });

  it("weist einen Titel mit TITLE_MAX + 1 Zeichen ab — auch beim Umbenennen", async () => {
    await expect(
      createFolderForUser({ userId, title: "b".repeat(TITLE_MAX + 1) })
    ).rejects.toThrow();
    await expect(
      updateFolderForUser({ userId, folderId: entityId, title: "b".repeat(TITLE_MAX + 1) })
    ).rejects.toThrow();
    expect(dbMocks.createFolder).not.toHaveBeenCalled();
    expect(dbMocks.updateFolder).not.toHaveBeenCalled();
  });

  it("trimmt Randleerraum und weist reinen Leerraum ab", async () => {
    await createFolderForUser({ userId, title: "  Schule  " });
    expect(dbMocks.createFolder).toHaveBeenCalledWith(userId, "Schule", undefined, undefined, undefined);
    await expect(createFolderForUser({ userId, title: " " })).rejects.toThrow();
  });

  it("lässt die Beschreibung bei ihren eigenen 500 Zeichen", async () => {
    await createFolderForUser({ userId, title: "Schule", description: "c".repeat(500) });
    expect(dbMocks.createFolder).toHaveBeenCalled();
    await expect(
      createFolderForUser({ userId, title: "Schule", description: "c".repeat(501) })
    ).rejects.toThrow();
  });
});
