import { normalizeOcrText } from "./normalizeOcrText";

export interface ScanPayloadInput {
  userId: string;
  idempotencyKey: string;
  editedText: string;
  sourceLanguage?: string;
  deckId?: string;
}

export function buildScanPayload(input: ScanPayloadInput) {
  return {
    userId: input.userId,
    idempotencyKey: input.idempotencyKey,
    extractedText: normalizeOcrText(input.editedText),
    sourceLanguage: input.sourceLanguage ?? "de",
    deckId: input.deckId
  };
}
