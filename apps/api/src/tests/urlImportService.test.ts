import { beforeEach, describe, expect, it, vi } from "vitest";
import { processUrlImport } from "@/services/urlImportService";
import { extractUrlContent } from "@/lib/urlContentExtractor";
import { generateFlashcardsFromUrlContentAsync } from "@/lib/llm";
import {
  createDeck,
  getDeck,
  insertCards,
  listCardIdsForDeck,
  listDeckIdsForUser,
  recordScan,
  softDeleteCardsByIds,
  softDeleteDeck,
} from "@/lib/db";
import { getIdempotentResult, storeIdempotentResult } from "@/lib/idempotencyStore";
import { getSubscriptionStatus } from "@/services/subscriptionService";

vi.mock("@/lib/urlContentExtractor", () => ({
  extractUrlContent: vi.fn(),
}));

vi.mock("@/lib/llm", () => ({
  generateFlashcardsFromUrlContentAsync: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  createDeck: vi.fn(),
  getDeck: vi.fn(),
  insertCards: vi.fn(),
  listCardIdsForDeck: vi.fn(),
  listDeckIdsForUser: vi.fn(),
  recordScan: vi.fn(),
  softDeleteCardsByIds: vi.fn(),
  softDeleteDeck: vi.fn(),
}));

vi.mock("@/lib/idempotencyStore", () => ({
  getIdempotentResult: vi.fn(),
  storeIdempotentResult: vi.fn(),
}));

vi.mock("@/services/subscriptionService", () => ({
  getSubscriptionStatus: vi.fn(),
}));

const mockedExtractUrlContent = vi.mocked(extractUrlContent);
const mockedGenerateFromUrl = vi.mocked(generateFlashcardsFromUrlContentAsync);
const mockedInsertCards = vi.mocked(insertCards);
const mockedCreateDeck = vi.mocked(createDeck);
const mockedGetDeck = vi.mocked(getDeck);
const mockedListCardIds = vi.mocked(listCardIdsForDeck);
const mockedListDeckIds = vi.mocked(listDeckIdsForUser);
const mockedRecordScan = vi.mocked(recordScan);
const mockedSoftDeleteCards = vi.mocked(softDeleteCardsByIds);
const mockedSoftDeleteDeck = vi.mocked(softDeleteDeck);
const mockedGetIdempotentResult = vi.mocked(getIdempotentResult);
const mockedStoreIdempotentResult = vi.mocked(storeIdempotentResult);
const mockedGetSubscriptionStatus = vi.mocked(getSubscriptionStatus);

describe("urlImportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetIdempotentResult.mockResolvedValue(null);
    mockedGetDeck.mockResolvedValue(null);
    mockedCreateDeck.mockResolvedValue({
      id: "deck-1",
      userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      title: "Web Import",
      tags: ["url-import"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
    });
    mockedInsertCards.mockResolvedValue([]);
    mockedListCardIds.mockResolvedValue([]);
    mockedListDeckIds.mockResolvedValue(["deck-1"]);
    mockedSoftDeleteCards.mockResolvedValue(0);
    mockedSoftDeleteDeck.mockResolvedValue(true);
    mockedGetSubscriptionStatus.mockResolvedValue({
      userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      tier: "free",
      isActive: false,
      expiresAt: null,
    });
    mockedRecordScan.mockResolvedValue("scan-1");
  });

  it("returns idempotent result when available", async () => {
    mockedGetIdempotentResult.mockResolvedValue({
      requestId: "req-idempotent",
      model: "gemini-3-flash",
      fallbackUsed: false,
      cards: [
        {
          front: "F",
          back: "B",
          type: "basic",
          difficulty: "medium",
          tags: [],
        },
      ],
      sourceUrl: "https://example.com",
      imagesUsed: 0,
    });

    const response = await processUrlImport(
      {
        userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
        sourceUrl: "https://example.com",
        idempotencyKey: "import-001-key",
      },
      "req-idempotent",
      "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a"
    );

    expect(response.requestId).toBe("req-idempotent");
    expect(mockedExtractUrlContent).not.toHaveBeenCalled();
    expect(mockedGenerateFromUrl).not.toHaveBeenCalled();
  });

  it("extracts URL text, generates cards and stores response — without loading images (#534)", async () => {
    mockedExtractUrlContent.mockResolvedValue({
      sourceUrl: "https://de.wikipedia.org/wiki/Mitochondrium",
      pageTitle: "Mitochondrium",
      extractedText: "Mitochondrien sind die Kraftwerke der Zelle.",
      images: [],
    });
    mockedGenerateFromUrl.mockResolvedValue({
      title: "Mitochondrium",
      model: "gemini-3-flash",
      fallbackUsed: false,
      cards: [
        {
          front: "Welche Aufgabe haben Mitochondrien?",
          back: "Sie erzeugen Energie in Form von ATP.",
          type: "basic",
          difficulty: "medium",
          tags: ["biologie"],
        },
      ],
    });

    const response = await processUrlImport(
      {
        userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
        sourceUrl: "https://de.wikipedia.org/wiki/Mitochondrium",
        idempotencyKey: "import-002-key",
        sourceLanguage: "de",
        maxImages: 4,
      },
      "req-2",
      "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a"
    );

    // No images are loaded, regardless of the client's maxImages.
    expect(mockedExtractUrlContent).toHaveBeenCalledWith({
      sourceUrl: "https://de.wikipedia.org/wiki/Mitochondrium",
      maxImages: 0,
    });
    expect(mockedGenerateFromUrl).toHaveBeenCalledTimes(1);
    expect(mockedGenerateFromUrl).toHaveBeenCalledWith(
      {
        sourceUrl: "https://de.wikipedia.org/wiki/Mitochondrium",
        pageTitle: "Mitochondrium",
        extractedText: "Mitochondrien sind die Kraftwerke der Zelle.",
        images: [],
      },
      "de"
    );
    expect(mockedCreateDeck).toHaveBeenCalledWith(
      "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      "Mitochondrium",
      ["url-import"]
    );
    expect(mockedInsertCards).toHaveBeenCalledTimes(1);
    expect(mockedInsertCards.mock.calls[0]?.[2]).toHaveLength(1);
    expect(mockedRecordScan).toHaveBeenCalledWith(
      "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      "gemini-3-flash",
      1,
      "https://de.wikipedia.org/wiki/Mitochondrium",
      "Mitochondrien sind die Kraftwerke der Zelle."
    );
    expect(mockedStoreIdempotentResult).toHaveBeenCalledTimes(1);

    expect(response).toMatchObject({
      requestId: "req-2",
      model: "gemini-3-flash",
      sourceUrl: "https://de.wikipedia.org/wiki/Mitochondrium",
      imagesUsed: 0,
      deckTitle: "Mitochondrium",
    });
    expect(response.cards).toHaveLength(1);
  });
});
