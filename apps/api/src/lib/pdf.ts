import { extractText } from "unpdf";
import { HttpError } from "./http";

// Silently dropped material used to be invisible: a 30-page PIT chapter holds
// ~42_000 characters, so more than half of it never reached the model and the
// learner got a deck that looked complete.
//
// Raising this only became worthwhile once generation was chunked. While a
// single call handled the whole text, card count plateaued around 33 no matter
// how much went in, so a bigger cap just spread the same cards more thinly.
// Chunked generation scales with length (one call per ~8_000 characters), so
// extra text now becomes extra cards.
const MAX_EXTRACTED_CHARACTERS = 60_000;
const MIN_MACHINE_TEXT_LENGTH = 120;

export interface ExtractedPdfText {
  pageCount: number;
  extractedText: string;
  extractedCharacters: number;
}

/**
 * Extrahiert den Text aus einem PDF (nur Text, kein Rendering). Nutzt `unpdf`
 * — eine serverless-taugliche Kapselung von PDF.js, die ohne Browser-Globals
 * (DOMMatrix &co.) und native Canvas-Fummelei auskommt. Reine Scan-PDFs ohne
 * Maschinentext werden mit 422 abgelehnt.
 */
export async function extractPdfText(fileBase64: string): Promise<ExtractedPdfText> {
  try {
    const data = Uint8Array.from(Buffer.from(fileBase64, "base64"));
    const { totalPages, text } = await extractText(data, { mergePages: true });

    const extractedText = text.replace(/\s+/g, " ").trim().slice(0, MAX_EXTRACTED_CHARACTERS);

    if (extractedText.length < MIN_MACHINE_TEXT_LENGTH) {
      throw new HttpError(
        "Die PDF enthält keinen ausreichend extrahierbaren Text. Reine Scan-PDFs werden im MVP noch nicht unterstützt.",
        422,
        "PDF_TEXT_NOT_FOUND"
      );
    }

    return {
      pageCount: totalPages,
      extractedText,
      extractedCharacters: extractedText.length,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError("PDF konnte nicht verarbeitet werden.", 422, "PDF_IMPORT_FAILED");
  }
}
