import { flashcardSchema } from "@/lib/contracts";
import { z } from "zod";
import { createCard, getDeck, softDeleteCard, updateCard } from "@/lib/db";
import { HttpError } from "@/lib/http";

const createCardSchema = z.object({
  userId: z.string().uuid(),
  deckId: z.string().uuid(),
  card: flashcardSchema,
});

const updateCardSchema = z.object({
  userId: z.string().uuid(),
  cardId: z.string().uuid(),
  front: z.string().min(1).optional(),
  back: z.string().min(1).optional(),
  type: flashcardSchema.shape.type.optional(),
  difficulty: flashcardSchema.shape.difficulty.optional(),
  tags: flashcardSchema.shape.tags.optional(),
  starred: z.boolean().optional(),
});

export async function createCardForUser(input: unknown) {
  const parsed = createCardSchema.parse(input);
  // Only allow adding cards to a deck the user owns
  const deck = await getDeck(parsed.deckId, parsed.userId);
  if (!deck) throw new HttpError("Deck not found", 404, "DECK_NOT_FOUND");
  return createCard(parsed.userId, parsed.deckId, parsed.card);
}

export async function updateCardForUser(input: unknown) {
  const parsed = updateCardSchema.parse(input);
  const updates: Partial<{
    front: string;
    back: string;
    type: "basic" | "cloze" | "mcq" | "matching";
    difficulty: "easy" | "medium" | "hard";
    tags: string[];
    starred: boolean;
  }> = {};
  if (parsed.front !== undefined) updates.front = parsed.front;
  if (parsed.back !== undefined) updates.back = parsed.back;
  if (parsed.type !== undefined) updates.type = parsed.type;
  if (parsed.difficulty !== undefined) updates.difficulty = parsed.difficulty;
  if (parsed.tags !== undefined) updates.tags = parsed.tags;
  if (parsed.starred !== undefined) updates.starred = parsed.starred;
  return updateCard(parsed.cardId, parsed.userId, updates);
}

export async function deleteCardForUser(userId: string, cardId: string): Promise<boolean> {
  return softDeleteCard(cardId, userId);
}
