import { z } from "zod";
import {
  createDeck,
  listDecks,
  listCardsForDeck,
  softDeleteDeck,
  updateDeck,
} from "@/lib/db";

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
