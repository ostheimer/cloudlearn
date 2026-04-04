import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { HttpError } from "./http";

const MAX_EXTRACTED_CHARACTERS = 20_000;
const MIN_MACHINE_TEXT_LENGTH = 120;

export interface ExtractedPdfText {
  pageCount: number;
  extractedText: string;
  extractedCharacters: number;
}

export async function extractPdfText(fileBase64: string): Promise<ExtractedPdfText> {
  let loadingTask:
    | ReturnType<typeof getDocument>
    | undefined;

  try {
    const data = Uint8Array.from(Buffer.from(fileBase64, "base64"));
    loadingTask = getDocument({
      data,
      useSystemFonts: true,
      isEvalSupported: false,
    });

    const document = await loadingTask.promise;
    let combinedText = "";

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (!pageText) {
        continue;
      }

      const nextChunk = combinedText.length === 0 ? pageText : `\n\n${pageText}`;
      const remainingCharacters = MAX_EXTRACTED_CHARACTERS - combinedText.length;
      if (remainingCharacters <= 0) {
        break;
      }

      combinedText += nextChunk.slice(0, remainingCharacters);

      if (combinedText.length >= MAX_EXTRACTED_CHARACTERS) {
        break;
      }
    }

    const extractedText = combinedText.trim();
    if (extractedText.length < MIN_MACHINE_TEXT_LENGTH) {
      throw new HttpError(
        "Die PDF enthält keinen ausreichend extrahierbaren Text. Reine Scan-PDFs werden im MVP noch nicht unterstützt.",
        422,
        "PDF_TEXT_NOT_FOUND"
      );
    }

    return {
      pageCount: document.numPages,
      extractedText,
      extractedCharacters: extractedText.length,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError("PDF konnte nicht verarbeitet werden.", 422, "PDF_IMPORT_FAILED");
  } finally {
    loadingTask?.destroy();
  }
}
