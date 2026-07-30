/**
 * Geteilte Decks nachziehen (#614) — Laras eigener Entwurf.
 *
 * Der Issue schlug vor, dass die App im Hintergrund nach Änderungen am Original
 * forscht. Laras Gegenvorschlag ist kleiner und besser: Die Person schickt den
 * Link noch einmal, und beim Öffnen erkennt clearn, dass eine Kopie schon
 * existiert. Zwei Knöpfe, sonst nichts.
 *
 * Nebenbei behebt das einen stillen Fehler: `importSharedDeck` legte bei einem
 * zweiten Klick auf denselben Link kommentarlos eine ZWEITE Kopie an —
 * `source_deck_id` wurde geschrieben und nie gelesen.
 *
 * Laras Regeln, die hier festgeschrieben sind:
 *  - **Nur Hinzufügen.** Niemals löschen, niemals überschreiben. Im Original
 *    gelöschte Karten bleiben in der eigenen Kopie; eine umformulierte Karte
 *    kommt zusätzlich an (beide Fassungen) — bewusst akzeptiert, weil ein
 *    Textvergleich „geändert" nicht von „neu" unterscheiden kann.
 *  - **Selbst Gelöschtes kommt nicht zurück.** Der Abgleich sieht auch die
 *    weich gelöschten Karten der eigenen Kopie.
 *  - **Am Kartenlimit wird ehrlich gemeldet**, wie viele nicht gepasst haben
 *    (#611), statt still zu kappen.
 */
import {
  findDeckCopiesOfSource,
  getDeckByShareToken,
  insertCards,
  listCardTextsIncludingDeleted,
  listCardsForDeck,
  type DeckRecord,
} from "@/lib/db";
import { HttpError } from "@/lib/http";
import { getLimitsForTier } from "@/lib/featureGates";
import { planSharedDeckSync, type CardText } from "@/lib/sharedDeckSync";
import { getSubscriptionStatus } from "./subscriptionService";

async function resolveSourceAndCopy(userId: string, shareToken: string) {
  const source = await getDeckByShareToken(shareToken);
  if (!source) {
    throw new HttpError("Shared deck not found or link expired", 404, "DECK_NOT_FOUND");
  }
  const copies = await findDeckCopiesOfSource(userId, source.id);
  return { source, copy: copies[0] ?? null };
}

/** Karten des Originals, auf die zwei Textseiten reduziert. */
async function sourceCardTexts(source: DeckRecord): Promise<CardText[]> {
  const cards = await listCardsForDeck(source.userId, source.id);
  return cards.map((card) => ({ front: card.front, back: card.back }));
}

export interface SyncPreview {
  /** Eigene Kopie, falls vorhanden — sonst `null` (dann ist es eine normale Übernahme). */
  existingDeck: { id: string; title: string } | null;
  /** Wie viele Karten des Originals in der eigenen Kopie fehlen. */
  newCardCount: number;
  /** Wie viele davon nicht mehr ins Deck passen. */
  skipped: number;
}

/**
 * „Dieses Deck hast du schon — 8 neue Karten." Beantwortet die Frage, BEVOR
 * etwas passiert, damit der Client die Wahl überhaupt anbieten kann.
 */
export async function previewSharedDeckSync(
  userId: string,
  shareToken: string
): Promise<SyncPreview> {
  const { source, copy } = await resolveSourceAndCopy(userId, shareToken);
  if (!copy) return { existingDeck: null, newCardCount: 0, skipped: 0 };

  const [sourceCards, ownTexts, { tier }] = await Promise.all([
    sourceCardTexts(source),
    listCardTextsIncludingDeleted(userId, copy.id),
    getSubscriptionStatus(userId),
  ]);
  // Freie Plätze zählen gegen die LEBENDEN Karten — gelöschte belegen keinen
  // Platz (dieselbe Regel, nach der countUserCards zählt).
  const liveCount = (await listCardsForDeck(userId, copy.id)).length;
  const plan = planSharedDeckSync(
    sourceCards,
    ownTexts,
    getLimitsForTier(tier).maxCardsPerDeck - liveCount
  );

  return {
    existingDeck: { id: copy.id, title: copy.title },
    newCardCount: plan.missing.length,
    skipped: plan.skipped,
  };
}

export interface SyncResult {
  deck: { id: string; title: string };
  added: number;
  skipped: number;
}

/** Führt „Aktualisieren" aus: die fehlenden Karten in die eigene Kopie legen. */
export async function syncSharedDeck(
  userId: string,
  shareToken: string
): Promise<SyncResult> {
  const { source, copy } = await resolveSourceAndCopy(userId, shareToken);
  if (!copy) {
    throw new HttpError(
      "Von diesem Deck hast du noch keine Kopie — übernimm es zuerst.",
      409,
      "NO_COPY_TO_SYNC"
    );
  }

  const [sourceCards, ownTexts, { tier }] = await Promise.all([
    sourceCardTexts(source),
    listCardTextsIncludingDeleted(userId, copy.id),
    getSubscriptionStatus(userId),
  ]);
  const liveCount = (await listCardsForDeck(userId, copy.id)).length;
  const plan = planSharedDeckSync(
    sourceCards,
    ownTexts,
    getLimitsForTier(tier).maxCardsPerDeck - liveCount
  );

  if (plan.fitting.length > 0) {
    await insertCards(
      userId,
      copy.id,
      plan.fitting.map((card) => ({
        front: card.front,
        back: card.back,
        type: "basic" as const,
        difficulty: "medium" as const,
        tags: [],
      }))
    );
  }

  return {
    deck: { id: copy.id, title: copy.title },
    added: plan.fitting.length,
    skipped: plan.skipped,
  };
}
