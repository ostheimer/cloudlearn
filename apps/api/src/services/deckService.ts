import { z } from "zod";
import {
  createDeck,
  listDecks,
  listCardsForDeck,
  softDeleteDeck,
  updateDeck,
  getDeck,
  duplicateDeck as dbDuplicateDeck,
  setDeckShareToken,
  getDeckShareToken,
  getDeckByShareToken as dbGetDeckByShareToken,
  getDeckWithCardCount,
  listCoursesForDeck,
  listFoldersForDeck,
} from "@/lib/db";
import { randomUUID } from "node:crypto";
import { HttpError } from "@/lib/http";

const createDeckSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1),
  tags: z.array(z.string()).default([]),
});

const updateDeckSchema = z.object({
  userId: z.string().uuid(),
  deckId: z.string().uuid(),
  title: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

export async function createDeckForUser(input: unknown) {
  const parsed = createDeckSchema.parse(input);
  return createDeck(parsed.userId, parsed.title, parsed.tags);
}

export async function listDecksForUser(userId: string) {
  return listDecks(userId);
}

export async function updateDeckForUser(input: unknown) {
  const parsed = updateDeckSchema.parse(input);
  const updates: Partial<{ title: string; tags: string[] }> = {};
  if (parsed.title !== undefined) updates.title = parsed.title;
  if (parsed.tags !== undefined) updates.tags = parsed.tags;
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
  const deck = await dbDuplicateDeck(userId, source.id, source.title);
  return { deck };
}

export async function getDeckDetails(userId: string, deckId: string) {
  const deck = await getDeckWithCardCount(deckId, userId);
  if (!deck) return null;
  const courses = await listCoursesForDeck(deckId);
  const folders = await listFoldersForDeck(deckId);
  return { ...deck, courses, folders };
}

export async function exportDeckForOffline(userId: string, deckId: string) {
  const deck = await getDeck(deckId, userId);
  if (!deck) throw new Error("Deck not found");
  const cards = await listCardsForDeck(userId, deckId);
  return { deck, cards };
}
