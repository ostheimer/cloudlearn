import {
  importSaveRequestSchema,
  importSaveResponseSchema,
  type ImportSaveResponse,
} from "@/lib/contracts";
import {
  getIdempotentResult,
  storeIdempotentResult,
  takeIdempotentResult,
} from "@/lib/idempotencyStore";
import {
  importPreviewReceiptKey,
  importSaveResultKey,
  parseImportPreviewReceipt,
} from "@/lib/importPreviewReceipt";
import { reserveImportTarget, storeImportedCards } from "@/lib/importCapacity";
import { HttpError } from "@/lib/http";
import { assertEntitlement } from "@/lib/limits";
import { getSubscriptionStatus } from "@/services/subscriptionService";

/**
 * Legt Karten ab, die zuvor mit `preview: true` erzeugt wurden (#427).
 *
 * Warum getrennt vom Import: Bis hierher hat die Nutzerin die Karten gesehen,
 * einzelne gelöscht und Texte verbessert. Was ankommt, ist also NICHT das
 * Modell-Ergebnis, sondern ihre Fassung davon — deshalb wird alles erneut
 * geprüft (`flashcardListSchema` im Request-Schema) statt Vertrauen zu schenken.
 *
 * Keine Lernpunkte: Die sind beim Erzeugen geflossen. Wer hier zweimal drückt,
 * bekommt über den Idempotenz-Schlüssel dasselbe Ergebnis statt doppelter
 * Karten.
 *
 * Grenzen: Es gelten dieselben wie beim direkten Import — ein volles Deck oder
 * eine erreichte Deck-Grenze lehnt `reserveImportTarget` mit 409 ab, und passt
 * das Material nur zum Teil, dünnt `storeImportedCards` gleichmäßig über den
 * ganzen Stoff aus, statt hinten abzuschneiden.
 */
export async function saveImportedCards(
  input: unknown,
  requestId: string,
  userId: string
): Promise<ImportSaveResponse> {
  const parsed = importSaveRequestSchema.parse(input);
  const receiptKey = importPreviewReceiptKey(
    userId,
    parsed.previewKind,
    parsed.previewIdempotencyKey
  );
  const saveKey = importSaveResultKey(
    userId,
    parsed.previewKind,
    parsed.previewIdempotencyKey
  );

  const existing = importSaveResponseSchema.safeParse(
    await getIdempotentResult<unknown>(saveKey)
  );
  if (existing.success) {
    return existing.data;
  }

  const availableReceipt = parseImportPreviewReceipt(
    await getIdempotentResult<unknown>(receiptKey)
  );
  if (!availableReceipt) {
    throw new HttpError(
      "Für diese Karten fehlt eine bezahlte Vorschau. Erzeuge die Vorschau erneut.",
      409,
      "PREVIEW_REQUIRED"
    );
  }
  if (parsed.cards.length > availableReceipt.cards.length) {
    throw new HttpError(
      "Die Vorschau enthält weniger Karten als der Speicherauftrag.",
      409,
      "PREVIEW_CARD_COUNT_EXCEEDED"
    );
  }

  const { tier } = await getSubscriptionStatus(userId);
  if (parsed.cards.some((card) => card.type === "occlusion")) {
    assertEntitlement(tier, "imageOcclusion");
  }

  // DELETE ... RETURNING is the atomic claim. Two concurrent save requests can
  // both validate the receipt above, but only one can take it and write cards.
  const claimedReceipt = parseImportPreviewReceipt(
    await takeIdempotentResult<unknown>(receiptKey)
  );
  if (!claimedReceipt) {
    const completed = importSaveResponseSchema.safeParse(
      await getIdempotentResult<unknown>(saveKey)
    );
    if (completed.success) return completed.data;
    throw new HttpError(
      "Diese Vorschau wird bereits gespeichert. Bitte versuche es gleich erneut.",
      409,
      "IMPORT_SAVE_IN_PROGRESS"
    );
  }

  try {
    const target = await reserveImportTarget({ userId, tier, deckId: parsed.deckId });

    // Ohne eigenen Titel bekommt ein neues Deck denselben Notnagel wie eh und je;
    // bei einem bestehenden Deck spielt der Titel keine Rolle, es behält seinen.
    const title = parsed.title ?? "Importierte Karten";

    const stored = await storeImportedCards({
      userId,
      tier,
      target,
      title,
      tags: ["scan"],
      cards: parsed.cards,
    });

    const response: ImportSaveResponse = {
      requestId,
      deckId: stored.deck.id,
      deckTitle: stored.deck.title,
      cards: stored.savedCards,
      generatedCount: stored.generatedCount,
      savedCount: stored.savedCount,
    };

    await storeIdempotentResult(saveKey, response);
    return response;
  } catch (error) {
    // A validation/capacity/database failure must not burn the one-shot receipt;
    // the client may correct the target or retry a transient failure.
    await storeIdempotentResult(receiptKey, claimedReceipt);
    throw error;
  }
}
