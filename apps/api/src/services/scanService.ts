import { flashcardListSchema, scanProcessRequestSchema, type ScanProcessResponse } from "@/lib/contracts";
import { createCard, createDeck, listDecks } from "@/lib/inMemoryStore";
import { getIdempotentResult, storeIdempotentResult } from "@/lib/idempotencyStore";
import { generateFlashcardsAsync, generateFlashcardsFromImageAsync } from "@/lib/llm";

export async function processScan(input: unknown, requestId: string): Promise<ScanProcessResponse> {
  const parsed = scanProcessRequestSchema.parse(input);
  const existing = getIdempotentResult<ScanProcessResponse>(parsed.idempotencyKey);
  if (existing) {
    return existing;
  }

  let generated: { cards: unknown[]; model: string; fallbackUsed: boolean };

  if (parsed.imageBase64) {
    // Image input → Gemini Vision
    const mimeType = parsed.imageMimeType ?? "image/jpeg";
    generated = await generateFlashcardsFromImageAsync(
      parsed.imageBase64,
      mimeType,
      parsed.sourceLanguage
    );
  } else if (parsed.extractedText) {
    // Text input → Gemini Text (with heuristic fallback)
    generated = await generateFlashcardsAsync(parsed.extractedText, parsed.sourceLanguage);
  } else {
    throw new Error("Either extractedText or imageBase64 must be provided");
  }

  const cards = flashcardListSchema.parse(generated.cards);

  const existingDeck = parsed.deckId
    ? listDecks(parsed.userId).find((item) => item.id === parsed.deckId)
    : null;
  const deck = existingDeck ?? createDeck(parsed.userId, "Automatisch erstellt", ["scan"]);

  for (const card of cards) {
    createCard(parsed.userId, deck.id, card);
  }

  const response: ScanProcessResponse = {
    requestId,
    model: generated.model,
    fallbackUsed: generated.fallbackUsed,
    cards,
  };

  storeIdempotentResult(parsed.idempotencyKey, response);
  return response;
}
