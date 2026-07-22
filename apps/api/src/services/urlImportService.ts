import {
  flashcardListSchema,
  urlImportRequestSchema,
  type UrlImportResponse,
} from "@/lib/contracts";
import { recordScan } from "@/lib/db";
import { getIdempotentResult, storeIdempotentResult } from "@/lib/idempotencyStore";
import { importPreviewReceiptKey } from "@/lib/importPreviewReceipt";
import { reserveImportTarget, storeImportedCards } from "@/lib/importCapacity";
import {
  generateFlashcardsFromUrlContentAsync,
  type LLMGenerationResult,
} from "@/lib/llm";
import { extractUrlContent } from "@/lib/urlContentExtractor";
import { getSubscriptionStatus } from "@/services/subscriptionService";

export async function processUrlImport(
  input: unknown,
  requestId: string,
  userId: string
): Promise<UrlImportResponse> {
  const parsed = urlImportRequestSchema.parse(input);
  const existing = await getIdempotentResult<UrlImportResponse>(parsed.idempotencyKey);
  if (existing) {
    return existing;
  }

  // Same plan limits as the scan path (#411), checked before the model runs so
  // a full deck refunds instead of half-delivering.
  const { tier } = await getSubscriptionStatus(userId);
  // #427: In der Vorschau wird nichts abgelegt — gespeichert wird erst über
  // importSaveService, wenn die Nutzerin Ziel und Karten festgelegt hat. Ein
  // bereits genanntes Deck wird trotzdem vorher geprüft.
  const checked = await reserveImportTarget({ userId, tier, deckId: parsed.deckId });
  const target = parsed.preview ? null : checked;

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

  if (!target) {
    await recordScan(userId, generated.model, 0, parsed.sourceUrl, extracted.extractedText);
    const previewResponse: UrlImportResponse = {
      requestId,
      model: generated.model,
      fallbackUsed: generated.fallbackUsed,
      cards,
      deckTitle: generated.title,
      sourceUrl: parsed.sourceUrl,
      imagesUsed: extracted.images.length,
      generatedCount: cards.length,
      savedCount: 0,
    };
    await storeIdempotentResult(
      importPreviewReceiptKey(userId, "url", parsed.idempotencyKey),
      previewResponse
    );
    await storeIdempotentResult(parsed.idempotencyKey, previewResponse);
    return previewResponse;
  }

  const stored = await storeImportedCards({
    userId,
    tier,
    target,
    title: generated.title,
    tags: ["url-import"],
    cards,
  });

  await recordScan(
    userId,
    generated.model,
    stored.savedCount,
    parsed.sourceUrl,
    extracted.extractedText
  );

  const response: UrlImportResponse = {
    requestId,
    model: generated.model,
    fallbackUsed: generated.fallbackUsed,
    cards: stored.savedCards,
    deckTitle: generated.title,
    sourceUrl: parsed.sourceUrl,
    imagesUsed: extracted.images.length,
    generatedCount: stored.generatedCount,
    savedCount: stored.savedCount,
  };

  await storeIdempotentResult(parsed.idempotencyKey, response);
  return response;
}
