import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/http";
import { extractPdfText } from "@/lib/pdf";
import { generateFlashcardsAsync } from "@/lib/llm";
import { createCard, createDeck, getDeck, recordScan } from "@/lib/db";
import { getIdempotentResult, storeIdempotentResult } from "@/lib/idempotencyStore";
import { processPdfImport } from "@/services/pdfImportService";

vi.mock("@/lib/pdf", () => ({
  extractPdfText: vi.fn(),
}));

vi.mock("@/lib/llm", () => ({
  generateFlashcardsAsync: vi.fn(),
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

const mockedExtractPdfText = vi.mocked(extractPdfText);
const mockedGenerateFlashcardsAsync = vi.mocked(generateFlashcardsAsync);
const mockedCreateCard = vi.mocked(createCard);
const mockedCreateDeck = vi.mocked(createDeck);
const mockedGetDeck = vi.mocked(getDeck);
const mockedRecordScan = vi.mocked(recordScan);
const mockedGetIdempotentResult = vi.mocked(getIdempotentResult);
const mockedStoreIdempotentResult = vi.mocked(storeIdempotentResult);

describe("pdfImportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetIdempotentResult.mockReturnValue(null);
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
    expect(mockedCreateCard).toHaveBeenCalledTimes(1);
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
