import {
  flashcardListSchema,
  scanProcessRequestSchema,
  type ScanProcessResponse,
} from "@/lib/contracts";
import { recordScan } from "@/lib/db";
import { getIdempotentResult, storeIdempotentResult } from "@/lib/idempotencyStore";
import { importPreviewReceiptKey } from "@/lib/importPreviewReceipt";
import { reserveImportTarget, storeImportedCards } from "@/lib/importCapacity";
import {
  generateFlashcardsAsync,
  generateFlashcardsFromImageAsync,
  type LLMGenerationResult,
} from "@/lib/llm";
import { getSubscriptionStatus } from "@/services/subscriptionService";

export async function processScan(
  input: unknown,
  requestId: string,
  userId: string
): Promise<ScanProcessResponse> {
  const parsed = scanProcessRequestSchema.parse(input);
  const existing = await getIdempotentResult<ScanProcessResponse>(
    parsed.idempotencyKey
  );
  if (existing) {
    return existing;
  }

  // Plan limits apply to the AI paths too (#411). Checked BEFORE the model runs
  // so a full deck neither costs a generation nor keeps the user's Lernpunkte:
  // throwing here makes the route refund them.
  //
  // #427: In der Vorschau wird nichts abgelegt — das Ziel wählt die Nutzerin
  // erst danach. Ein bereits genanntes Deck wird trotzdem geprüft (ist es voll,
  // wäre die Erzeugung für die Katz), das Ergebnis aber nicht zum Speichern
  // benutzt: `target` bleibt in der Vorschau immer leer.
  const { tier } = await getSubscriptionStatus(userId);
  const checked = await reserveImportTarget({ userId, tier, deckId: parsed.deckId });
  const target = parsed.preview ? null : checked;

  let generated: LLMGenerationResult;

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

  // #427: Vorschau — erzeugen, zurückgeben, nichts ablegen. Gespeichert wird
  // später über importSaveService, wenn die Nutzerin Ziel und Karten festgelegt
  // hat. In der Historie steht der Scan trotzdem: Er hat stattgefunden und
  // Lernpunkte gekostet, unabhängig davon, ob am Ende etwas übrig bleibt.
  if (!target) {
    await recordScan(userId, generated.model, 0, "", parsed.extractedText ?? undefined);
    const previewResponse: ScanProcessResponse = {
      requestId,
      model: generated.model,
      fallbackUsed: generated.fallbackUsed,
      cards,
      deckTitle: generated.title,
      generatedCount: cards.length,
      savedCount: 0,
    };
    await storeIdempotentResult(
      importPreviewReceiptKey(userId, "scan", parsed.idempotencyKey),
      previewResponse
    );
    await storeIdempotentResult(parsed.idempotencyKey, previewResponse);
    return previewResponse;
  }

  // Uses the AI-generated title for a new deck instead of a generic one.
  const stored = await storeImportedCards({
    userId,
    tier,
    target,
    title: generated.title,
    tags: ["scan"],
    cards,
  });

  // Record scan in history — the number that was really saved, not the number
  // the model produced.
  await recordScan(
    userId,
    generated.model,
    stored.savedCount,
    "",
    parsed.extractedText ?? undefined
  );

  const response: ScanProcessResponse = {
    requestId,
    model: generated.model,
    fallbackUsed: generated.fallbackUsed,
    cards: stored.savedCards,
    deckTitle: generated.title,
    generatedCount: stored.generatedCount,
    savedCount: stored.savedCount,
  };

  await storeIdempotentResult(parsed.idempotencyKey, response);
  return response;
}
