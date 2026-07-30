import {
  importSaveRequestSchema,
  type ImportSaveResponse,
} from "@/lib/contracts";
import { getIdempotentResult, storeIdempotentResult } from "@/lib/idempotencyStore";
import { reserveImportTarget, storeImportedCards } from "@/lib/importCapacity";
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

  const existing = await getIdempotentResult<ImportSaveResponse>(parsed.idempotencyKey);
  if (existing) {
    return existing;
  }

  const { tier } = await getSubscriptionStatus(userId);

  // Die Karten kommen vom Client und dürfen bearbeitet sein — also auch im TYP.
  // `cardService.ts` prüft dasselbe beim Anlegen von Hand (#235); ohne diese
  // Zeile wäre die Pro-Schranke für Bild-Occlusion über den Import-Weg
  // umgehbar, indem ein Gratis-Konto die Anfrage selbst zusammenbaut. Geprüft
  // wird VOR `reserveImportTarget`, damit eine Ablehnung nichts anlegt.
  if (parsed.cards.some((card) => card.type === "occlusion")) {
    assertEntitlement(tier, "imageOcclusion");
  }

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
    // Nur belegt, wenn das hier das erste Deck des Kontos war (#637).
    milestones: stored.milestones,
  };

  await storeIdempotentResult(parsed.idempotencyKey, response);
  return response;
}
