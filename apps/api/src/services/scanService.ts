import {
  flashcardListSchema,
  scanProcessRequestSchema,
  type ScanProcessResponse,
} from "@/lib/contracts";
import { createCard, createDeck, getDeck, listDecks, recordScan } from "@/lib/db";
import { getIdempotentResult, storeIdempotentResult } from "@/lib/idempotencyStore";
import {
  generateFlashcardsAsync,
  generateFlashcardsFromImageAsync,
} from "@/lib/llm";

export async function processScan(
  input: unknown,
  requestId: string,
  userId: string
): Promise<ScanProcessResponse> {
  const parsed = scanProcessRequestSchema.parse(input);
  const existing = getIdempotentResult<ScanProcessResponse>(
    parsed.idempotencyKey
  );
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
    generated = await generateFlashcardsAsync(
      parsed.extractedText,
      parsed.sourceLanguage
    );
  } else {
    throw new Error("Either extractedText or imageBase64 must be provided");
  }

  const cards = flashcardListSchema.parse(generated.cards);

  // Use authenticated userId instead of body userId
  let deck = parsed.deckId ? await getDeck(parsed.deckId) : null;
  if (!deck) {
    deck = await createDeck(userId, "Automatisch erstellt", ["scan"]);
  }

  for (const card of cards) {
    await createCard(userId, deck.id, card);
  }

  // Record scan in history
  await recordScan(
    userId,
    generated.model,
    cards.length,
    "",
    parsed.extractedText ?? undefined
  );

  const response: ScanProcessResponse = {
    requestId,
    model: generated.model,
    fallbackUsed: generated.fallbackUsed,
    cards,
  };

  storeIdempotentResult(parsed.idempotencyKey, response);
  return response;
}
