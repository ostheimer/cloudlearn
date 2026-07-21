import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/http";
import { extractPdfText } from "@/lib/pdf";
import { generateFlashcardsAsync } from "@/lib/llm";
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
import { processPdfImport } from "@/services/pdfImportService";

vi.mock("@/lib/pdf", () => ({
  extractPdfText: vi.fn(),
}));

vi.mock("@/lib/llm", () => ({
  generateFlashcardsAsync: vi.fn(),
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

const mockedExtractPdfText = vi.mocked(extractPdfText);
const mockedGenerateFlashcardsAsync = vi.mocked(generateFlashcardsAsync);
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

describe("pdfImportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetIdempotentResult.mockResolvedValue(null);
    mockedGetDeck.mockResolvedValue(null);
    mockedCreateDeck.mockResolvedValue({
      id: "deck-1",
      userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      title: "Biologie Skript",
      tags: ["pdf-import"],
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
      deckTitle: "Biologie Skript",
      fileName: "skript.pdf",
      pageCount: 12,
      extractedCharacters: 1200,
    });

    const response = await processPdfImport(
      {
        userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
        fileName: "skript.pdf",
        fileBase64: "A".repeat(200),
        idempotencyKey: "pdf-import-001-key",
      },
      "req-idempotent",
      "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a"
    );

    expect(response.requestId).toBe("req-idempotent");
    expect(mockedExtractPdfText).not.toHaveBeenCalled();
    expect(mockedGenerateFlashcardsAsync).not.toHaveBeenCalled();
  });

  it("extracts PDF text, generates cards and stores response", async () => {
    mockedExtractPdfText.mockResolvedValue({
      pageCount: 12,
      extractedText: "Mitochondrien erzeugen ATP durch oxidative Phosphorylierung.",
      extractedCharacters: 59,
    });
    mockedGenerateFlashcardsAsync.mockResolvedValue({
      title: "Biologie Skript",
      model: "gemini-3-flash",
      fallbackUsed: false,
      cards: [
        {
          front: "Was erzeugen Mitochondrien?",
          back: "ATP",
          type: "basic",
          difficulty: "medium",
          tags: ["bio"],
        },
      ],
    });

    const response = await processPdfImport(
      {
        userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
        fileName: "Biologie Skript.pdf",
        fileBase64: "A".repeat(200),
        idempotencyKey: "pdf-import-002-key",
        sourceLanguage: "de",
      },
      "req-2",
      "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a"
    );

    expect(mockedExtractPdfText).toHaveBeenCalledWith("A".repeat(200));
    expect(mockedGenerateFlashcardsAsync).toHaveBeenCalledWith(
      "Mitochondrien erzeugen ATP durch oxidative Phosphorylierung.",
      "de"
    );
    expect(mockedCreateDeck).toHaveBeenCalledWith(
      "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      "Biologie Skript",
      ["pdf-import"]
    );
    expect(mockedInsertCards).toHaveBeenCalledTimes(1);
    expect(mockedInsertCards.mock.calls[0]?.[2]).toHaveLength(1);
    expect(mockedRecordScan).toHaveBeenCalledWith(
      "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      "gemini-3-flash",
      1,
      "pdf:Biologie_Skript.pdf",
      "Mitochondrien erzeugen ATP durch oxidative Phosphorylierung."
    );
    expect(mockedStoreIdempotentResult).toHaveBeenCalledTimes(1);
    expect(response).toMatchObject({
      requestId: "req-2",
      model: "gemini-3-flash",
      deckTitle: "Biologie Skript",
      fileName: "Biologie Skript.pdf",
      pageCount: 12,
      extractedCharacters: 59,
    });
  });

  it("surfaces a clear error for scan-only PDFs", async () => {
    mockedExtractPdfText.mockRejectedValue(
      new HttpError(
        "Die PDF enthält keinen ausreichend extrahierbaren Text. Reine Scan-PDFs werden im MVP noch nicht unterstützt.",
        422,
        "PDF_TEXT_NOT_FOUND"
      )
    );

    await expect(() =>
      processPdfImport(
        {
          userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
          fileName: "Scan.pdf",
          fileBase64: "A".repeat(200),
          idempotencyKey: "pdf-import-003-key",
        },
        "req-3",
        "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a"
      )
    ).rejects.toMatchObject({
      message:
        "Die PDF enthält keinen ausreichend extrahierbaren Text. Reine Scan-PDFs werden im MVP noch nicht unterstützt.",
      status: 422,
      code: "PDF_TEXT_NOT_FOUND",
    });
  });
});
