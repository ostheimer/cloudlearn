import { flashcardSchema } from "@/lib/contracts";
import { z } from "zod";
import { createCard, softDeleteCard, updateCard } from "@/lib/db";

const createCardSchema = z.object({
  userId: z.string().uuid(),
  deckId: z.string().uuid(),
  card: flashcardSchema,
});

const updateCardSchema = z.object({
  cardId: z.string().uuid(),
  front: z.string().min(1).optional(),
  back: z.string().min(1).optional(),
  type: flashcardSchema.shape.type.optional(),
  difficulty: flashcardSchema.shape.difficulty.optional(),
  tags: flashcardSchema.shape.tags.optional(),
});

export async function createCardForUser(input: unknown) {
  const parsed = createCardSchema.parse(input);
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
  }> = {};
  if (parsed.front !== undefined) updates.front = parsed.front;
  if (parsed.back !== undefined) updates.back = parsed.back;
  if (parsed.type !== undefined) updates.type = parsed.type;
  if (parsed.difficulty !== undefined) updates.difficulty = parsed.difficulty;
  if (parsed.tags !== undefined) updates.tags = parsed.tags;
  return updateCard(parsed.cardId, updates);
}

export async function deleteCardForUser(cardId: string): Promise<boolean> {
  return softDeleteCard(cardId);
}
