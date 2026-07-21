/**
 * #411: the plan limits used to hold only for the manual "new card" / "new
 * deck" buttons. Scan, PDF import and URL import wrote straight into the
 * database. These tests pin the fix down for all three paths at service level.
 *
 * Two properties matter beyond "it throws":
 *  - the refusal happens BEFORE the model runs, so a full deck costs neither a
 *    generation nor the user's Lernpunkte (the route refunds on any throw), and
 *  - the refusal is 409, never 402 — a 402 makes the app offer "buy
 *    Lernpunkte" for a problem no Lernpunkte can fix (#371).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLimitsForTier } from "@/lib/featureGates";

const USER_ID = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";
const DECK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const dbState = vi.hoisted(() => ({
  deckIds: [] as string[],
  cardIds: [] as string[],
  nextCardId: 0,
}));

function deckRecord(id: string) {
  return {
    id,
    userId: USER_ID,
    title: "Deck",
    tags: [],
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
  };
}

vi.mock("@/lib/db", () => ({
  getDeck: vi.fn(async (deckId: string) =>
    dbState.deckIds.includes(deckId) ? deckRecord(deckId) : null
  ),
  createDeck: vi.fn(async () => {
    const id = `deck-neu-${dbState.deckIds.length}`;
    dbState.deckIds.push(id);
    return deckRecord(id);
  }),
  softDeleteDeck: vi.fn(async (deckId: string) => {
    dbState.deckIds = dbState.deckIds.filter((id) => id !== deckId);
    return true;
  }),
  listDeckIdsForUser: vi.fn(async () => [...dbState.deckIds]),
  insertCards: vi.fn(async (_userId: string, _deckId: string, cards: unknown[]) =>
    cards.map(() => {
      const id = `neu-${dbState.nextCardId++}`;
      dbState.cardIds.push(id);
      return { id };
    })
  ),
  listCardIdsForDeck: vi.fn(async () => [...dbState.cardIds]),
  softDeleteCardsByIds: vi.fn(async (_userId: string, _deckId: string, ids: string[]) => {
    dbState.cardIds = dbState.cardIds.filter((id) => !ids.includes(id));
    return ids.length;
  }),
  recordScan: vi.fn(async () => "scan-1"),
}));

vi.mock("@/lib/llm", () => ({
  generateFlashcardsAsync: vi.fn(),
  generateFlashcardsFromImageAsync: vi.fn(),
  generateFlashcardsFromUrlContentAsync: vi.fn(),
}));

vi.mock("@/lib/pdf", () => ({ extractPdfText: vi.fn() }));
vi.mock("@/lib/urlContentExtractor", () => ({ extractUrlContent: vi.fn() }));
vi.mock("@/lib/idempotencyStore", () => ({
  getIdempotentResult: vi.fn(),
  storeIdempotentResult: vi.fn(),
}));
vi.mock("@/services/subscriptionService", () => ({ getSubscriptionStatus: vi.fn() }));

import { insertCards, recordScan } from "@/lib/db";
import {
  generateFlashcardsAsync,
  generateFlashcardsFromUrlContentAsync,
} from "@/lib/llm";
import { extractPdfText } from "@/lib/pdf";
import { extractUrlContent } from "@/lib/urlContentExtractor";
import { getIdempotentResult } from "@/lib/idempotencyStore";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import { processScan } from "@/services/scanService";
import { processPdfImport } from "@/services/pdfImportService";
import { processUrlImport } from "@/services/urlImportService";

const mockedInsertCards = vi.mocked(insertCards);
const mockedRecordScan = vi.mocked(recordScan);
const mockedGenerateText = vi.mocked(generateFlashcardsAsync);
const mockedGenerateUrl = vi.mocked(generateFlashcardsFromUrlContentAsync);
const mockedExtractPdf = vi.mocked(extractPdfText);
const mockedExtractUrl = vi.mocked(extractUrlContent);
const mockedGetIdempotentResult = vi.mocked(getIdempotentResult);
const mockedSubscription = vi.mocked(getSubscriptionStatus);

function generatedCards(count: number) {
  return Array.from({ length: count }, (_value, index) => ({
    front: `Frage ${index}`,
    back: `Antwort ${index}`,
    type: "basic" as const,
    difficulty: "medium" as const,
    tags: [] as string[],
  }));
}

function seedDecks(count: number): void {
  dbState.deckIds = Array.from({ length: count }, (_value, index) => `deck-${index}`);
}

function seedCards(count: number): void {
  dbState.cardIds = Array.from({ length: count }, (_value, index) => `alt-${index}`);
}

function setTier(tier: "free" | "pro" | "lifetime"): void {
  mockedSubscription.mockResolvedValue({
    userId: USER_ID,
    tier,
    isActive: tier !== "free",
    expiresAt: null,
  });
}

const scanBody = {
  userId: USER_ID,
  extractedText: "Mitochondrien erzeugen ATP.",
  idempotencyKey: "scan-limit-key",
};
const pdfBody = {
  userId: USER_ID,
  fileName: "Skript.pdf",
  fileBase64: "A".repeat(200),
  idempotencyKey: "pdf-limit-key",
};
const urlBody = {
  userId: USER_ID,
  sourceUrl: "https://example.com",
  idempotencyKey: "url-limit-key",
};

beforeEach(() => {
  vi.clearAllMocks();
  dbState.deckIds = [];
  dbState.cardIds = [];
  dbState.nextCardId = 0;
  setTier("free");
  mockedGetIdempotentResult.mockResolvedValue(null);
  mockedGenerateText.mockResolvedValue({
    title: "Themengebiet 4",
    model: "gemini-3-flash",
    fallbackUsed: false,
    cards: generatedCards(140),
  });
  mockedGenerateUrl.mockResolvedValue({
    title: "Themengebiet 4",
    model: "gemini-3-flash",
    fallbackUsed: false,
    cards: generatedCards(140),
  });
  mockedExtractPdf.mockResolvedValue({
    pageCount: 12,
    extractedText: "Text aus dem Skript.",
    extractedCharacters: 20,
  });
  mockedExtractUrl.mockResolvedValue({
    sourceUrl: "https://example.com",
    pageTitle: "Seite",
    extractedText: "Text der Seite.",
    images: [],
  });
});

describe("plan limits on the AI import paths (#411)", () => {
  it.each([
    ["scan", () => processScan(scanBody, "req-1", USER_ID)],
    ["pdf import", () => processPdfImport(pdfBody, "req-1", USER_ID)],
    ["url import", () => processUrlImport(urlBody, "req-1", USER_ID)],
  ])("refuses %s at the deck limit before anything is generated", async (_name, run) => {
    seedDecks(getLimitsForTier("free").maxDecks);

    await expect(run()).rejects.toMatchObject({
      status: 409,
      code: "DECK_LIMIT_REACHED",
    });

    expect(mockedGenerateText).not.toHaveBeenCalled();
    expect(mockedGenerateUrl).not.toHaveBeenCalled();
    expect(mockedExtractPdf).not.toHaveBeenCalled();
    expect(mockedExtractUrl).not.toHaveBeenCalled();
    expect(mockedInsertCards).not.toHaveBeenCalled();
  });

  it.each([
    ["scan", () => processScan({ ...scanBody, deckId: DECK_ID }, "req-1", USER_ID)],
    ["pdf import", () => processPdfImport({ ...pdfBody, deckId: DECK_ID }, "req-1", USER_ID)],
    ["url import", () => processUrlImport({ ...urlBody, deckId: DECK_ID }, "req-1", USER_ID)],
  ])("refuses %s into a full deck with 409, never 402", async (_name, run) => {
    dbState.deckIds = [DECK_ID];
    seedCards(getLimitsForTier("free").maxCardsPerDeck);

    const error = await run().catch((caught: unknown) => caught);

    expect(error).toMatchObject({ status: 409, code: "DECK_FULL" });
    // The old app build turns EVERY 402 into "buy Lernpunkte" (#371).
    expect((error as { status: number }).status).not.toBe(402);
    // German, so the old build's generic alert shows something usable.
    expect((error as Error).message).toContain("Dieses Deck ist voll");
    expect(mockedInsertCards).not.toHaveBeenCalled();
  });

  it.each([
    ["scan", () => processScan({ ...scanBody, deckId: DECK_ID }, "req-1", USER_ID)],
    ["pdf import", () => processPdfImport({ ...pdfBody, deckId: DECK_ID }, "req-1", USER_ID)],
    ["url import", () => processUrlImport({ ...urlBody, deckId: DECK_ID }, "req-1", USER_ID)],
  ])("thins %s down to the free slots and reports both numbers", async (_name, run) => {
    dbState.deckIds = [DECK_ID];
    seedCards(138);

    const response = await run();

    expect(response.generatedCount).toBe(140);
    expect(response.savedCount).toBe(12);
    expect(response.cards).toHaveLength(12);
    // Evenly spread over the whole chapter, not the first twelve.
    expect(response.cards[0]!.front).toBe("Frage 0");
    expect(response.cards.at(-1)!.front).toBe("Frage 139");
    expect(mockedInsertCards.mock.calls[0]?.[2]).toHaveLength(12);
    // The scan history records what was saved, not what was generated.
    expect(mockedRecordScan.mock.calls[0]?.[2]).toBe(12);
  });

  it("leaves an already over-limit deck completely alone", async () => {
    dbState.deckIds = [DECK_ID];
    seedCards(200);
    const before = [...dbState.cardIds];

    await expect(
      processScan({ ...scanBody, deckId: DECK_ID }, "req-1", USER_ID)
    ).rejects.toMatchObject({ code: "DECK_FULL" });

    expect(dbState.cardIds).toEqual(before);
  });

  it("does not get in the way of pro", async () => {
    setTier("pro");
    seedDecks(getLimitsForTier("free").maxDecks);

    const response = await processScan(scanBody, "req-1", USER_ID);

    expect(response.savedCount).toBe(140);
    expect(response.cards).toHaveLength(140);
  });

  it("does not get in the way of lifetime", async () => {
    setTier("lifetime");
    seedDecks(getLimitsForTier("free").maxDecks);

    const response = await processScan(scanBody, "req-1", USER_ID);

    expect(response.savedCount).toBe(140);
  });

  it("lets a full-size generation into a fresh free deck untouched", async () => {
    // MAX_GENERATED_CARDS (150) equals the new free limit, so a brand new deck
    // can always take a whole generation — truncation only ever bites on a deck
    // that already holds cards.
    mockedGenerateText.mockResolvedValue({
      title: "Themengebiet 4",
      model: "gemini-3-flash",
      fallbackUsed: false,
      cards: generatedCards(getLimitsForTier("free").maxCardsPerDeck),
    });

    const response = await processScan(scanBody, "req-1", USER_ID);

    expect(response.savedCount).toBe(getLimitsForTier("free").maxCardsPerDeck);
    expect(response.generatedCount).toBe(getLimitsForTier("free").maxCardsPerDeck);
  });
});
