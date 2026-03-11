import {
  flashcardListSchema,
  urlImportRequestSchema,
  type UrlImportResponse,
} from "@/lib/contracts";
import { createCard, createDeck, getDeck, recordScan } from "@/lib/db";
import { getIdempotentResult, storeIdempotentResult } from "@/lib/idempotencyStore";
import {
  generateFlashcardsFromUrlContentAsync,
  type LLMGenerationResult,
} from "@/lib/llm";
import { extractUrlContent } from "@/lib/urlContentExtractor";

export async function processUrlImport(
  input: unknown,
  requestId: string,
  userId: string
): Promise<UrlImportResponse> {
  const parsed = urlImportRequestSchema.parse(input);
  const existing = getIdempotentResult<UrlImportResponse>(parsed.idempotencyKey);
  if (existing) {
    return existing;
  }

  const extracted = await extractUrlContent({
    sourceUrl: parsed.sourceUrl,
    maxImages: parsed.maxImages,
  });

  let generated: LLMGenerationResult;
  generated = await generateFlashcardsFromUrlContentAsync(
    {
      sourceUrl: extracted.sourceUrl,
      pageTitle: extracted.pageTitle,
      extractedText: extracted.extractedText,
      images: extracted.images.map((image) => ({
        sourceUrl: image.url,
        altText: image.altText,
        contextText: image.contextText,
        componentHint: image.componentHint,
        mimeType: image.mimeType,
        dataBase64: image.dataBase64,
      })),
    },
    parsed.sourceLanguage
  );

  const cards = flashcardListSchema.parse(generated.cards);

  let deck = parsed.deckId ? await getDeck(parsed.deckId) : null;
  if (!deck) {
    deck = await createDeck(userId, generated.title, ["url-import"]);
  }

  for (const card of cards) {
    await createCard(userId, deck.id, card);
  }

  await recordScan(
    userId,
    generated.model,
    cards.length,
    parsed.sourceUrl,
    extracted.extractedText
  );

  const response: UrlImportResponse = {
    requestId,
    model: generated.model,
    fallbackUsed: generated.fallbackUsed,
    cards,
    deckTitle: generated.title,
    sourceUrl: parsed.sourceUrl,
    imagesUsed: extracted.images.length,
  };

  storeIdempotentResult(parsed.idempotencyKey, response);
  return response;
}
