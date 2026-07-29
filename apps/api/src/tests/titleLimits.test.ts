/**
 * Titel-Grenzen für Decks und Ordner (#612).
 *
 * Vorher hatten die Schemata nur `.min(1)` — tausende Zeichen liessen sich als
 * Titel speichern und sprengten jede Liste, und "   " galt als gültiger Name.
 * Jetzt: trimmen, dann auf TITLE_MAX=120 KAPPEN — nicht abweisen, denn
 * Scan-Titel schreibt die KI und ausgelieferte App-Builds haben keinen
 * Tipp-Stopp; deren Speichern darf an der neuen Grenze nicht scheitern.
 * Die Beschreibung behält ihre eigenen 500 (dort weiterhin .max, Clients
 * deckeln die Eingabe). Dieser Test hält die Servergrenze fest — nie dem
 * Client vertrauen.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { TITLE_MAX, clampTitle } from "@/lib/titleLimit";

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

describe("clampTitle — kappt nach Code-Punkten", () => {
  it("lässt Titel bis TITLE_MAX unangetastet", () => {
    expect(clampTitle("Biologie")).toBe("Biologie");
    expect(clampTitle("a".repeat(TITLE_MAX))).toBe("a".repeat(TITLE_MAX));
  });

  it("kappt längere Titel auf exakt TITLE_MAX", () => {
    expect(clampTitle("a".repeat(TITLE_MAX + 50))).toBe("a".repeat(TITLE_MAX));
  });

  it("halbiert kein Emoji an der Schnittkante", () => {
    // 119 ASCII-Zeichen + Emoji (2 UTF-16-Einheiten): naives .slice(0, 120)
    // schnitte das Surrogatpaar auseinander — ungültiges UTF-8, die Datenbank
    // wiese die Zeile ab. Nach Code-Punkten bleibt das Emoji ganz.
    const clamped = clampTitle("a".repeat(TITLE_MAX - 1) + "\u{1F600}\u{1F600}");
    expect(clamped).toBe("a".repeat(TITLE_MAX - 1) + "\u{1F600}");
  });
});

describe("Deck-Titel — getrimmt und bei 120 gekappt (#612)", () => {
  it("nimmt einen Titel mit exakt TITLE_MAX Zeichen unverändert an", async () => {
    await createDeckForUser({ userId, title: "a".repeat(TITLE_MAX), tags: [] });
    expect(dbMocks.createDeck).toHaveBeenCalledWith(userId, "a".repeat(TITLE_MAX), []);
  });

  it("kappt einen zu langen Titel, statt das Speichern scheitern zu lassen", async () => {
    // Der Scan schickt KI-Titel durch genau diesen Weg — ausgelieferte
    // App-Builds ohne Tipp-Stopp dürfen hier keinen Fehler bekommen.
    await createDeckForUser({ userId, title: "a".repeat(TITLE_MAX + 80), tags: [] });
    expect(dbMocks.createDeck).toHaveBeenCalledWith(userId, "a".repeat(TITLE_MAX), []);
  });

  it("trimmt Randleerraum, statt ihn mitzuzählen oder zu speichern", async () => {
    await createDeckForUser({ userId, title: "  Biologie  ", tags: [] });
    expect(dbMocks.createDeck).toHaveBeenCalledWith(userId, "Biologie", []);
  });

  it("weist einen Titel aus nur Leerraum weiterhin ab", async () => {
    await expect(createDeckForUser({ userId, title: "   ", tags: [] })).rejects.toThrow();
    expect(dbMocks.createDeck).not.toHaveBeenCalled();
  });

  it("kappt auch beim Umbenennen", async () => {
    await updateDeckForUser({ userId, deckId: entityId, title: "a".repeat(TITLE_MAX + 1) });
    expect(dbMocks.updateDeck).toHaveBeenCalledWith(entityId, userId, {
      title: "a".repeat(TITLE_MAX),
    });
  });

  it("lässt ein Update ohne Titel unangetastet durch", async () => {
    await updateDeckForUser({ userId, deckId: entityId, tags: ["bio"] });
    expect(dbMocks.updateDeck).toHaveBeenCalledWith(entityId, userId, { tags: ["bio"] });
  });
});

describe("Ordner-Titel — gleiche Grenze wie Decks (#612)", () => {
  it("nimmt einen Titel mit exakt TITLE_MAX Zeichen an", async () => {
    await createFolderForUser({ userId, title: "b".repeat(TITLE_MAX) });
    expect(dbMocks.createFolder).toHaveBeenCalledWith(
      userId,
      "b".repeat(TITLE_MAX),
      undefined,
      undefined,
      undefined
    );
  });

  it("kappt zu lange Titel beim Anlegen und Umbenennen", async () => {
    await createFolderForUser({ userId, title: "b".repeat(TITLE_MAX + 30) });
    expect(dbMocks.createFolder).toHaveBeenCalledWith(
      userId,
      "b".repeat(TITLE_MAX),
      undefined,
      undefined,
      undefined
    );
    await updateFolderForUser({ userId, folderId: entityId, title: "b".repeat(TITLE_MAX + 30) });
    expect(dbMocks.updateFolder).toHaveBeenCalled();
    const updates = dbMocks.updateFolder.mock.calls[0]?.[2] as { title?: string };
    expect(updates.title).toBe("b".repeat(TITLE_MAX));
  });

  it("trimmt Randleerraum und weist reinen Leerraum ab", async () => {
    await createFolderForUser({ userId, title: "  Schule  " });
    expect(dbMocks.createFolder).toHaveBeenCalledWith(userId, "Schule", undefined, undefined, undefined);
    await expect(createFolderForUser({ userId, title: " " })).rejects.toThrow();
  });

  it("lässt die Beschreibung bei ihren eigenen 500 Zeichen (dort weiterhin abweisen)", async () => {
    // Die Beschreibung tippt IMMER eine Nutzerin (kein KI-Weg), und beide
    // Clients deckeln die Eingabe — hartes .max() bleibt hier richtig.
    await createFolderForUser({ userId, title: "Schule", description: "c".repeat(500) });
    expect(dbMocks.createFolder).toHaveBeenCalled();
    await expect(
      createFolderForUser({ userId, title: "Schule", description: "c".repeat(501) })
    ).rejects.toThrow();
  });
});
