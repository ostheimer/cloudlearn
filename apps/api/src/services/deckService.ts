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
  getDeckByShareToken as dbGetDeckByShareToken,
  getDeckWithCardCount,
  listCoursesForDeck,
  listFoldersForDeck,
} from "@/lib/db";
import { randomUUID } from "node:crypto";

const createDeckSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1),
  tags: z.array(z.string()).default([]),
});

const updateDeckSchema = z.object({
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
  return updateDeck(parsed.deckId, updates);
}

export async function deleteDeckForUser(deckId: string): Promise<boolean> {
  return softDeleteDeck(deckId);
}

export async function listCardsInDeck(userId: string, deckId: string) {
  return listCardsForDeck(userId, deckId);
}

export async function duplicateDeckForUser(userId: string, deckId: string) {
  const sourceDeck = await getDeck(deckId);
  if (!sourceDeck) throw new Error("Deck not found");
  const newTitle = `${sourceDeck.title} (Kopie)`;
  return dbDuplicateDeck(userId, deckId, newTitle);
}

export async function generateShareToken(deckId: string) {
  const deck = await getDeck(deckId);
  if (!deck) throw new Error("Deck not found");
  const shareToken = randomUUID();
  const updated = await setDeckShareToken(deckId, shareToken);
  if (!updated) throw new Error("Could not generate share token");
  return { shareToken, deck: updated };
}

export async function getDeckByShareToken(shareToken: string) {
  return dbGetDeckByShareToken(shareToken);
}

export async function getDeckDetails(deckId: string) {
  const deck = await getDeckWithCardCount(deckId);
  if (!deck) return null;
  const courses = await listCoursesForDeck(deckId);
  const folders = await listFoldersForDeck(deckId);
  return { ...deck, courses, folders };
}

export async function exportDeckForOffline(userId: string, deckId: string) {
  const deck = await getDeck(deckId);
  if (!deck) throw new Error("Deck not found");
  const cards = await listCardsForDeck(userId, deckId);
  return { deck, cards };
}
