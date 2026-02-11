import { flashcardListSchema, scanProcessRequestSchema, type ScanProcessResponse } from "@/lib/contracts";
import { createCard, createDeck, listDecks } from "@/lib/inMemoryStore";
import { getIdempotentResult, storeIdempotentResult } from "@/lib/idempotencyStore";
import { generateWithModelFallback } from "@/lib/llm";

export function processScan(input: unknown, requestId: string): ScanProcessResponse {
  const parsed = scanProcessRequestSchema.parse(input);
  const existing = getIdempotentResult<ScanProcessResponse>(parsed.idempotencyKey);
  if (existing) {
    return existing;
  }

  const generated = generateWithModelFallback(parsed.extractedText, parsed.sourceLanguage);
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
    cards
  };

  storeIdempotentResult(parsed.idempotencyKey, response);
  return response;
}
