import { cardTagsSchema, cardTypeSchema, difficultySchema, flashcardSchema } from "@/lib/contracts";
import { z } from "zod";
import type { CardRecord } from "@/lib/db";
import { createCard, getDeck, listCardsForDeck, softDeleteCard, updateCard } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { getSubscriptionStatus } from "./subscriptionService";
import { assertCardLimit } from "@/lib/limits";

const createCardSchema = z.object({
  userId: z.string().uuid(),
  deckId: z.string().uuid(),
  card: flashcardSchema,
});

// A PATCH must touch ONLY the fields the caller actually sent. Deliberately does
// NOT reuse `flashcardSchema.shape.*`: those carry `.default(...)`, and in zod v4
// `.default(x).optional()` still fills in `x` when the key is absent (unlike v3,
// where the optional wrapper short-circuited first). Reusing them made every
// update silently write type="basic"/difficulty="medium"/tags=[], downgrading
// occlusion/cloze cards to basic on an unrelated change such as starring.
// Reuse the default-free base schemas instead so absent keys stay `undefined`.
const updateCardSchema = z.object({
  userId: z.string().uuid(),
  cardId: z.string().uuid(),
  front: z.string().min(1).optional(),
  back: z.string().min(1).optional(),
  type: cardTypeSchema.optional(),
  difficulty: difficultySchema.optional(),
  tags: cardTagsSchema.optional(),
  starred: z.boolean().optional(),
});

export async function createCardForUser(input: unknown) {
  const parsed = createCardSchema.parse(input);
  // Only allow adding cards to a deck the user owns
  const deck = await getDeck(parsed.deckId, parsed.userId);
  if (!deck) throw new HttpError("Deck not found", 404, "DECK_NOT_FOUND");
  const { tier } = await getSubscriptionStatus(parsed.userId);
  const existingCards = await listCardsForDeck(parsed.userId, parsed.deckId);
  assertCardLimit(tier, existingCards.length);
  return createCard(parsed.userId, parsed.deckId, parsed.card);
}

export async function updateCardForUser(input: unknown) {
  const parsed = updateCardSchema.parse(input);
  // Mirrors updateCard's own parameter type, so the allowed card types cannot
  // drift from the contract as they're extended.
  const updates: Partial<
    Pick<CardRecord, "front" | "back" | "type" | "difficulty" | "tags" | "starred">
  > = {};
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
