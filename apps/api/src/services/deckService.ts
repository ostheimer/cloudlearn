import { z } from "zod";
import {
  countCardsInDeck,
  createDeck,
  countUserDecks,
  listDecks,
  setDeckArchived,
  listCardsForDeck,
  softDeleteDeck,
  updateDeck,
  getDeck,
  duplicateDeck as dbDuplicateDeck,
  setDeckShareToken,
  getDeckShareToken,
  clearDeckShareToken,
  getDeckByShareToken as dbGetDeckByShareToken,
  getDeckWithCardCount,
  listFoldersForDeck,
} from "@/lib/db";
import { randomUUID } from "node:crypto";
import { HttpError } from "@/lib/http";
import { speechLangSchema, type SpeechLanguage } from "@/lib/speechLanguages";
import { getSubscriptionStatus } from "./subscriptionService";
import { assertDeckCopyFits, assertDeckLimit, assertEntitlement } from "@/lib/limits";
import { clampTitle } from "@/lib/titleLimit";

// Titel (#612): trimmen, damit "   " kein gültiger Name ist, und auf 120
// Zeichen KAPPEN statt abweisen — Scan-Titel schreibt die KI, und alte
// App-Builds haben keinen Tipp-Stopp (siehe titleLimit.ts). Gleiches Schema
// wie bei Ordnern (folderService).
const titleSchema = z.string().trim().min(1).transform(clampTitle);

const createDeckSchema = z.object({
  userId: z.string().uuid(),
  title: titleSchema,
  tags: z.array(z.string()).default([]),
});

const updateDeckSchema = z.object({
  userId: z.string().uuid(),
  deckId: z.string().uuid(),
  title: titleSchema.optional(),
  tags: z.array(z.string()).optional(),
  // Vorlese-Sprachen (#571): `null` löscht die Einstellung, ein fehlendes Feld
  // lässt sie unangetastet. Siehe speechLangSchema.
  speechLangFront: speechLangSchema,
  speechLangBack: speechLangSchema,
});

/**
 * Gezählt wird über `countUserDecks`, NICHT über `listDecks`: seit dem
 * Archivieren (#614) liefert `listDecks` nur die aktiven. Ein archiviertes
 * Deck ist aber nicht weg — würde es nicht mitzählen, wäre Archivieren ein
 * Weg um die Tarif-Grenze herum (archivieren, neu anlegen, wiederholen).
 */
async function assertCanCreateDeck(userId: string): Promise<void> {
  const { tier } = await getSubscriptionStatus(userId);
  assertDeckLimit(tier, await countUserDecks(userId));
}

/**
 * Both limits for a deck COPY (#611): room for another deck, and room for all
 * of the source deck's cards.
 *
 * The second check is the one that was missing — duplicating and importing
 * copied every card without ever asking `maxCardsPerDeck`, so a shared link
 * from a Pro account handed a free account a deck it could never have built
 * itself.
 *
 * Deck limit first: if there is no room for another deck at all, the card count
 * is beside the point, and that message names the more immediate problem.
 * Tier is fetched once for both checks.
 */
async function assertCanCopyDeck(userId: string, sourceDeckId: string): Promise<void> {
  const { tier } = await getSubscriptionStatus(userId);
  // Wie oben: archivierte Decks zählen mit (countUserDecks statt listDecks).
  assertDeckLimit(tier, await countUserDecks(userId));
  assertDeckCopyFits(tier, await countCardsInDeck(sourceDeckId));
}

export async function createDeckForUser(input: unknown) {
  const parsed = createDeckSchema.parse(input);
  await assertCanCreateDeck(parsed.userId);
  return createDeck(parsed.userId, parsed.title, parsed.tags);
}

export async function listDecksForUser(userId: string, options: { archived?: boolean } = {}) {
  return listDecks(userId, options);
}

/**
 * Deck archivieren oder zurückholen (#614, Laras Auswahl aus Punkt 9).
 *
 * „Alt-Schuljahr raus, ohne es zu löschen." Beim Zurückholen wird KEINE
 * Deck-Grenze geprüft: das Deck hat seinen Platz nie freigegeben — es zählte
 * auch archiviert mit (siehe assertCanCreateDeck). Eine Prüfung hier könnte
 * jemanden dauerhaft von den eigenen Karten aussperren.
 */
export async function setDeckArchivedForUser(
  userId: string,
  deckId: string,
  archived: boolean
) {
  const deck = await setDeckArchived(deckId, userId, archived);
  if (!deck) throw new HttpError("Deck not found", 404, "DECK_NOT_FOUND");
  return { deck };
}

export async function updateDeckForUser(input: unknown) {
  const parsed = updateDeckSchema.parse(input);
  const updates: Partial<{
    title: string;
    tags: string[];
    speechLangFront: SpeechLanguage | null;
    speechLangBack: SpeechLanguage | null;
  }> = {};
  if (parsed.title !== undefined) updates.title = parsed.title;
  if (parsed.tags !== undefined) updates.tags = parsed.tags;
  // Auf `undefined` prüfen, nicht auf Falsy: `null` ist hier eine echte Angabe
  // („Sprache wieder entfernen") und muss durchgereicht werden.
  if (parsed.speechLangFront !== undefined) updates.speechLangFront = parsed.speechLangFront;
  if (parsed.speechLangBack !== undefined) updates.speechLangBack = parsed.speechLangBack;
  return updateDeck(parsed.deckId, parsed.userId, updates);
}

export async function deleteDeckForUser(userId: string, deckId: string): Promise<boolean> {
  return softDeleteDeck(deckId, userId);
}

export async function listCardsInDeck(userId: string, deckId: string) {
  return listCardsForDeck(userId, deckId);
}

export async function duplicateDeckForUser(userId: string, deckId: string) {
  const sourceDeck = await getDeck(deckId, userId);
  if (!sourceDeck) throw new Error("Deck not found");
  await assertCanCopyDeck(userId, deckId);
  const newTitle = `${sourceDeck.title} (Kopie)`;
  return dbDuplicateDeck(userId, deckId, newTitle);
}

export async function generateShareToken(userId: string, deckId: string) {
  const deck = await getDeck(deckId, userId);
  if (!deck) throw new Error("Deck not found");
  // Reuse an existing token so previously sent share links stay valid
  const existingToken = await getDeckShareToken(deckId, userId);
  if (existingToken) return { shareToken: existingToken, deck };
  const shareToken = randomUUID();
  const updated = await setDeckShareToken(deckId, userId, shareToken);
  if (!updated) throw new Error("Could not generate share token");
  return { shareToken, deck: updated };
}

/**
 * Revokes a deck's share link (#519). Only the owner may do this for their
 * own deck; a foreign or missing deck is a 404 (never reveals existence).
 * After this, the old link resolves to "not found" and a later share()
 * mints a fresh token. Idempotent — revoking an unshared deck is a no-op.
 */
export async function revokeShareToken(userId: string, deckId: string) {
  const deck = await getDeck(deckId, userId);
  if (!deck) throw new HttpError("Deck not found", 404, "DECK_NOT_FOUND");
  const updated = await clearDeckShareToken(deckId, userId);
  if (!updated) throw new HttpError("Deck not found", 404, "DECK_NOT_FOUND");
  return { deck: updated };
}

export async function getDeckByShareToken(shareToken: string) {
  return dbGetDeckByShareToken(shareToken);
}

/**
 * Imports a shared deck into the caller's library as an independent copy.
 * Possession of the share token is the authorization — no ownership needed.
 * The copy gets fresh cards with reset FSRS progress; the original is
 * untouched and later edits on either side don't affect the other.
 */
export async function importSharedDeck(userId: string, shareToken: string) {
  const source = await dbGetDeckByShareToken(shareToken);
  if (!source) {
    throw new HttpError("Shared deck not found or link expired", 404, "DECK_NOT_FOUND");
  }
  await assertCanCopyDeck(userId, source.id);
  const deck = await dbDuplicateDeck(userId, source.id, source.title);
  return { deck };
}

export async function getDeckDetails(userId: string, deckId: string) {
  const deck = await getDeckWithCardCount(deckId, userId);
  if (!deck) return null;
  const folders = await listFoldersForDeck(deckId);
  return { ...deck, folders };
}

export async function exportDeckForOffline(userId: string, deckId: string) {
  // Offline download is a Pro entitlement (#235) — enforce it server-side, not
  // just by hiding the button in the client.
  const { tier } = await getSubscriptionStatus(userId);
  assertEntitlement(tier, "offlineDownload");
  const deck = await getDeck(deckId, userId);
  if (!deck) throw new Error("Deck not found");
  const cards = await listCardsForDeck(userId, deckId);
  return { deck, cards };
}
