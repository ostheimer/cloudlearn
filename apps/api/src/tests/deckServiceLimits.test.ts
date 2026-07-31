import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLimitsForTier } from "@/lib/featureGates";
import { HttpError } from "@/lib/http";
import type { DeckRecord } from "@/lib/db";

const dbMocks = vi.hoisted(() => ({
  countCardsInDeck: vi.fn(),
  createDeck: vi.fn(),
  listDecks: vi.fn(),
  countUserDecks: vi.fn(),
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
}));

const subscriptionMocks = vi.hoisted(() => ({
  getSubscriptionStatus: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  countCardsInDeck: dbMocks.countCardsInDeck,
  createDeck: dbMocks.createDeck,
  listDecks: dbMocks.listDecks,
  countUserDecks: dbMocks.countUserDecks,
  listCardsForDeck: dbMocks.listCardsForDeck,
  softDeleteDeck: dbMocks.softDeleteDeck,
  updateDeck: dbMocks.updateDeck,
  getDeck: dbMocks.getDeck,
  duplicateDeck: dbMocks.duplicateDeck,
  setDeckShareToken: dbMocks.setDeckShareToken,
  getDeckShareToken: dbMocks.getDeckShareToken,
  getDeckByShareToken: dbMocks.getDeckByShareToken,
  getDeckWithCardCount: dbMocks.getDeckWithCardCount,
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

/**
 * Die Deck-Grenze zählt seit dem Archivieren (#614) über `countUserDecks`
 * statt über `listDecks`: `listDecks` liefert nur noch die AKTIVEN Decks,
 * archivierte müssen aber mitzählen — sonst wäre Archivieren ein Weg um die
 * Grenze herum. Beides wird gesetzt, damit die Tests unabhängig davon
 * bleiben, welchen Weg der Service nimmt.
 */
function setDeckCount(count: number): void {
  dbMocks.countUserDecks.mockResolvedValue(count);
  dbMocks.listDecks.mockResolvedValue(existingDecks(count));
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
    // Default: das Quell-Deck ist klein genug. Die Karten-Grenze ist erst seit
    // #611 überhaupt im Spiel, die Deck-Grenz-Tests unten sollen sie nicht
    // versehentlich mit auslösen.
    dbMocks.countCardsInDeck.mockResolvedValue(3);
  });

  it("blocks duplicating a deck when the user is at the deck limit", async () => {
    dbMocks.getDeck.mockResolvedValue(sourceDeck);
    setDeckCount(getLimitsForTier("free").maxDecks);

    await expect(duplicateDeckForUser(userId, sourceDeckId)).rejects.toMatchObject({
      status: 409,
      // Eigener Code seit #371 — vorher trug diese Ablehnung PAYWALL_REQUIRED
      // und war damit nicht von "braucht Pro" unterscheidbar.
      code: "DECK_LIMIT_REACHED",
    } satisfies Partial<HttpError>);

    expect(dbMocks.duplicateDeck).not.toHaveBeenCalled();
  });

  it("blocks importing a shared deck when the user is at the deck limit", async () => {
    dbMocks.getDeckByShareToken.mockResolvedValue(sourceDeck);
    setDeckCount(getLimitsForTier("free").maxDecks);

    await expect(importSharedDeck(userId, "share-token")).rejects.toMatchObject({
      status: 409,
      // Eigener Code seit #371 — vorher trug diese Ablehnung PAYWALL_REQUIRED
      // und war damit nicht von "braucht Pro" unterscheidbar.
      code: "DECK_LIMIT_REACHED",
    } satisfies Partial<HttpError>);

    expect(dbMocks.duplicateDeck).not.toHaveBeenCalled();
  });
});

describe("Kopieren umgeht die Karten-Grenze nicht mehr (#611)", () => {
  const maxCards = getLimitsForTier("free").maxCardsPerDeck;

  beforeEach(() => {
    vi.clearAllMocks();
    subscriptionMocks.getSubscriptionStatus.mockResolvedValue({
      userId,
      tier: "free",
      isActive: false,
      expiresAt: null,
    });
    setDeckCount(2);
    dbMocks.getDeck.mockResolvedValue(sourceDeck);
    dbMocks.getDeckByShareToken.mockResolvedValue(sourceDeck);
  });

  it("lehnt ein geteiltes Deck ab, das groesser ist als der eigene Tarif erlaubt", async () => {
    // Der eigentliche Missbrauchsweg: Ein Pro-Konto teilt ein 2000-Karten-Deck,
    // ein Gratis-Konto uebernimmt es und hat legal Karten, die es selbst nie
    // haette anlegen duerfen.
    dbMocks.countCardsInDeck.mockResolvedValue(2000);

    await expect(importSharedDeck(userId, "share-token")).rejects.toMatchObject({
      status: 409,
      code: "DECK_FULL",
    } satisfies Partial<HttpError>);

    expect(dbMocks.duplicateDeck).not.toHaveBeenCalled();
  });

  it("lehnt das Duplizieren eines Decks ab, das schon ueber der Grenze liegt", async () => {
    // Solche Decks gibt es in Produktion (Pro-Zeit, Direkt-Eintraege in die DB).
    // Sie bleiben unangetastet — nur vervielfaeltigen kann man sie nicht mehr.
    dbMocks.countCardsInDeck.mockResolvedValue(762);

    await expect(duplicateDeckForUser(userId, sourceDeckId)).rejects.toMatchObject({
      status: 409,
      code: "DECK_FULL",
    } satisfies Partial<HttpError>);

    expect(dbMocks.duplicateDeck).not.toHaveBeenCalled();
  });

  it("nennt beide Zahlen und den Ausweg, statt nur abzulehnen", async () => {
    dbMocks.countCardsInDeck.mockResolvedValue(762);

    await expect(duplicateDeckForUser(userId, sourceDeckId)).rejects.toThrow(
      `Dieses Deck hat 762 Karten — dein Tarif erlaubt ${maxCards} pro Deck. Mit Pro hast du deutlich mehr Platz.`
    );
  });

  it("verspricht Pro-Konten KEIN Upgrade, das ihnen nichts brächte", async () => {
    subscriptionMocks.getSubscriptionStatus.mockResolvedValue({
      userId,
      tier: "pro",
      isActive: true,
      expiresAt: null,
    });
    dbMocks.countCardsInDeck.mockResolvedValue(getLimitsForTier("pro").maxCardsPerDeck + 1);

    await expect(duplicateDeckForUser(userId, sourceDeckId)).rejects.toThrow(
      /Kopieren ist deshalb nicht möglich\./
    );
  });

  it("kopiert ein Deck, das genau auf der Grenze liegt", async () => {
    // Grenzfall: `maxCardsPerDeck` Karten passen exakt. Erst die naechste
    // Karte von Hand lehnt assertCardLimit ab — wie bisher.
    dbMocks.countCardsInDeck.mockResolvedValue(maxCards);
    dbMocks.duplicateDeck.mockResolvedValue({ ...sourceDeck, id: "neu" });

    await expect(duplicateDeckForUser(userId, sourceDeckId)).resolves.toMatchObject({
      id: "neu",
    });
    expect(dbMocks.duplicateDeck).toHaveBeenCalledTimes(1);
  });

  it("laesst normale Decks unbehelligt durch", async () => {
    dbMocks.countCardsInDeck.mockResolvedValue(42);
    dbMocks.duplicateDeck.mockResolvedValue({ ...sourceDeck, id: "neu" });

    await expect(importSharedDeck(userId, "share-token")).resolves.toMatchObject({
      deck: { id: "neu" },
    });
    expect(dbMocks.duplicateDeck).toHaveBeenCalledTimes(1);
  });

  it("zaehlt die Karten des QUELL-Decks, nicht die des Konten-Bestands", async () => {
    dbMocks.countCardsInDeck.mockResolvedValue(42);
    dbMocks.duplicateDeck.mockResolvedValue({ ...sourceDeck, id: "neu" });

    await duplicateDeckForUser(userId, sourceDeckId);

    expect(dbMocks.countCardsInDeck).toHaveBeenCalledWith(sourceDeckId);
  });
});
