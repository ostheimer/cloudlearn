/**
 * Papierkorb (#614) — gelöschte Decks und Karten ansehen, zurückholen oder
 * endgültig entfernen.
 *
 * Bis hierher konnte Löschen niemand rückgängig machen: `deleted_at` wurde
 * gesetzt, alle Leser blendeten die Zeile aus, und das war es. Das war der
 * einzige unheilbare Schaden im ganzen Produkt.
 *
 * Zwei Entscheidungen von Lara stecken fest in diesem Modul:
 *
 *  1. **Nichts verschwindet von allein.** Es gibt bewusst keinen Purge-Job und
 *     keine Frist. Wer aufräumen will, drückt selbst „endgültig löschen" oder
 *     „Papierkorb leeren". Der Preis ist ein Papierkorb, der wächst; der Gewinn
 *     ist, dass kein Zeitablauf etwas wegwirft, das noch gebraucht wird.
 *  2. **Selbst Gelöschtes kommt nicht zurück.** Wer eine Karte einzeln
 *     weggeworfen und später das ganze Deck gelöscht hat, bekommt beim
 *     Deck-Restore genau die Karten zurück, die MIT dem Deck gefallen sind —
 *     die einzeln entsorgte bleibt weg (Zeitstempel-Regel in db.restoreDeck).
 *     Sie steht danach im Papierkorb unter „einzelne Karten" und lässt sich
 *     von dort separat zurückholen.
 */
import { z } from "zod";
import {
  getDeletedCard,
  getDeletedDeck,
  countUserDecks,
  listCardsForDeck,
  listTrash,
  purgeAllTrash,
  purgeTrashCard,
  purgeTrashDeck,
  restoreCard,
  restoreDeck,
} from "@/lib/db";
import { HttpError } from "@/lib/http";
import { assertCardLimit, assertDeckLimit } from "@/lib/limits";
import { getSubscriptionStatus } from "./subscriptionService";

const uuid = z.string().uuid();

export async function getTrashForUser(userId: string) {
  return listTrash(userId);
}

/**
 * Deck zurückholen — aber nur, wenn im Tarif noch ein Deck-Platz frei ist.
 *
 * Die Prüfung ist keine Schikane: ohne sie wäre der Papierkorb ein Weg, die
 * Deck-Grenze beliebig zu überschreiten (löschen, neu anlegen, alles
 * zurückholen). Abgelehnt wird ehrlich mit derselben Sprache wie beim Anlegen
 * (assertDeckLimit, 409 + DECK_LIMIT_REACHED, #611) statt stillschweigend
 * gekappt.
 *
 * Die Karten des Decks werden NICHT gegen `maxCardsPerDeck` geprüft. Sie waren
 * beim Löschen erlaubt, und ein Tarifwechsel darf niemandem den Zugang zu
 * eigenen Karten nehmen — dieselbe Linie, die cardService beim Occlusion-Gate
 * zieht („existing ones stay readable").
 */
export async function restoreDeckForUser(userId: string, deckId: string): Promise<boolean> {
  uuid.parse(deckId);
  const deck = await getDeletedDeck(deckId, userId);
  if (!deck) return false;

  const { tier } = await getSubscriptionStatus(userId);
  // countUserDecks statt listDecks: archivierte Decks zählen mit, seit es
  // das Archiv gibt (#614) — sie sind nicht weg, nur ausgeblendet.
  assertDeckLimit(tier, await countUserDecks(userId));

  return restoreDeck(deckId, userId);
}

/**
 * Einzelne Karte zurückholen.
 *
 * Zwei Gründe für ein Nein, beide mit klarer Auskunft statt eines stummen
 * Fehlschlags: das Deck der Karte liegt selbst im Papierkorb (dann muss erst
 * das Deck zurück, sonst wäre die Karte unsichtbar), oder das Deck ist voll.
 */
export async function restoreCardForUser(userId: string, cardId: string): Promise<boolean> {
  uuid.parse(cardId);
  const card = await getDeletedCard(cardId, userId);
  if (!card) return false;

  if (card.deckDeleted) {
    throw new HttpError(
      "Das Deck dieser Karte liegt selbst im Papierkorb. Hol zuerst das Deck zurück — seine Karten kommen mit.",
      409,
      "DECK_IN_TRASH"
    );
  }

  const { tier } = await getSubscriptionStatus(userId);
  const liveCards = await listCardsForDeck(userId, card.deckId);
  assertCardLimit(tier, liveCards.length);

  return restoreCard(cardId, userId);
}

export async function purgeDeckForUser(userId: string, deckId: string): Promise<boolean> {
  uuid.parse(deckId);
  return purgeTrashDeck(deckId, userId);
}

export async function purgeCardForUser(userId: string, cardId: string): Promise<boolean> {
  uuid.parse(cardId);
  return purgeTrashCard(cardId, userId);
}

export async function emptyTrashForUser(userId: string) {
  return purgeAllTrash(userId);
}
