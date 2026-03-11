import { beforeEach, describe, expect, it, vi } from "vitest";
import { processUrlImport } from "@/services/urlImportService";
import { extractUrlContent } from "@/lib/urlContentExtractor";
import { generateFlashcardsFromUrlContentAsync } from "@/lib/llm";
import { createCard, createDeck, getDeck, recordScan } from "@/lib/db";
import { getIdempotentResult, storeIdempotentResult } from "@/lib/idempotencyStore";

vi.mock("@/lib/urlContentExtractor", () => ({
  extractUrlContent: vi.fn(),
}));

vi.mock("@/lib/llm", () => ({
  generateFlashcardsFromUrlContentAsync: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  createCard: vi.fn(),
  createDeck: vi.fn(),
  getDeck: vi.fn(),
  recordScan: vi.fn(),
}));

vi.mock("@/lib/idempotencyStore", () => ({
  getIdempotentResult: vi.fn(),
  storeIdempotentResult: vi.fn(),
}));

const mockedExtractUrlContent = vi.mocked(extractUrlContent);
const mockedGenerateFromUrl = vi.mocked(generateFlashcardsFromUrlContentAsync);
const mockedCreateCard = vi.mocked(createCard);
const mockedCreateDeck = vi.mocked(createDeck);
const mockedGetDeck = vi.mocked(getDeck);
const mockedRecordScan = vi.mocked(recordScan);
const mockedGetIdempotentResult = vi.mocked(getIdempotentResult);
const mockedStoreIdempotentResult = vi.mocked(storeIdempotentResult);

describe("urlImportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetIdempotentResult.mockReturnValue(null);
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
    mockedCreateCard.mockResolvedValue({
      id: "card-1",
      userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      deckId: "deck-1",
      front: "Frage",
      back: "Antwort",
      type: "basic",
      difficulty: "medium",
      tags: [],
      starred: false,
      fsrsDue: "2026-01-01T00:00:00.000Z",
      fsrsStability: 0,
      fsrsDifficulty: 0,
      fsrsState: "new",
      fsrsReps: 0,
      fsrsLapses: 0,
      fsrsElapsedDays: 0,
      fsrsScheduledDays: 0,
      fsrsLearningSteps: 0,
      fsrsLastReview: null,
      deletedAt: null,
    });
    mockedRecordScan.mockResolvedValue("scan-1");
  });

  it("returns idempotent result when available", async () => {
    mockedGetIdempotentResult.mockReturnValue({
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

  it("extracts URL content, generates cards and stores response", async () => {
    mockedExtractUrlContent.mockResolvedValue({
      sourceUrl: "https://example.com",
      pageTitle: "Component Gallery",
      extractedText: "A page with UI components and labels.",
      images: [
        {
          url: "https://example.com/image.png",
          altText: "Button group",
          contextText: "UI component labels",
          componentHint: "Button group",
          mimeType: "image/png",
          dataBase64: "AQIDBA==",
        },
      ],
    });
    mockedGenerateFromUrl.mockResolvedValue({
      title: "Component Gallery",
      model: "gemini-3-flash-vision",
      fallbackUsed: false,
      cards: [
        {
          front: "![Button group](https://example.com/image.png)\nWelches Element ist markiert?",
          back: "Primary Button",
          type: "basic",
          difficulty: "medium",
          tags: ["ui"],
        },
      ],
    });

    const response = await processUrlImport(
      {
        userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
        sourceUrl: "https://example.com",
        idempotencyKey: "import-002-key",
        sourceLanguage: "de",
        maxImages: 4,
      },
      "req-2",
      "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a"
    );

    expect(mockedExtractUrlContent).toHaveBeenCalledWith({
      sourceUrl: "https://example.com",
      maxImages: 4,
    });
    expect(mockedGenerateFromUrl).toHaveBeenCalledTimes(1);
    expect(mockedGenerateFromUrl).toHaveBeenCalledWith(
      {
        sourceUrl: "https://example.com",
        pageTitle: "Component Gallery",
        extractedText: "A page with UI components and labels.",
        images: [
          {
            sourceUrl: "https://example.com/image.png",
            altText: "Button group",
            contextText: "UI component labels",
            componentHint: "Button group",
            mimeType: "image/png",
            dataBase64: "AQIDBA==",
          },
        ],
      },
      "de"
    );
    expect(mockedCreateDeck).toHaveBeenCalledWith(
      "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      "Component Gallery",
      ["url-import"]
    );
    expect(mockedCreateCard).toHaveBeenCalledTimes(1);
    expect(mockedRecordScan).toHaveBeenCalledWith(
      "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      "gemini-3-flash-vision",
      1,
      "https://example.com",
      "A page with UI components and labels."
    );
    expect(mockedStoreIdempotentResult).toHaveBeenCalledTimes(1);

    expect(response).toMatchObject({
      requestId: "req-2",
      model: "gemini-3-flash-vision",
      sourceUrl: "https://example.com",
      imagesUsed: 1,
      deckTitle: "Component Gallery",
    });
    expect(response.cards).toHaveLength(1);
  });
});
