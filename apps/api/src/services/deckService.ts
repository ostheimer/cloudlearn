import { z } from "zod";
import { createDeck, listCardsForDeck, listDecks, softDeleteDeck, updateDeck } from "@/lib/inMemoryStore";

const createDeckSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1),
  tags: z.array(z.string()).default([])
});

const updateDeckSchema = z.object({
  deckId: z.string().uuid(),
  title: z.string().min(1).optional(),
  tags: z.array(z.string()).optional()
});

export function createDeckForUser(input: unknown) {
  const parsed = createDeckSchema.parse(input);
  return createDeck(parsed.userId, parsed.title, parsed.tags);
}

export function listDecksForUser(userId: string) {
  return listDecks(userId);
}

export function updateDeckForUser(input: unknown) {
  const parsed = updateDeckSchema.parse(input);
  const updates: Partial<{ title: string; tags: string[] }> = {};
  if (parsed.title !== undefined) {
    updates.title = parsed.title;
  }
  if (parsed.tags !== undefined) {
    updates.tags = parsed.tags;
  }

  return updateDeck(parsed.deckId, updates);
}

export function deleteDeckForUser(deckId: string): boolean {
  return softDeleteDeck(deckId);
}

export function listCardsInDeck(userId: string, deckId: string) {
  return listCardsForDeck(userId, deckId);
}
