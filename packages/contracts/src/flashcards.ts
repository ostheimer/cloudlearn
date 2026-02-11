import { z } from "zod";

export const cardTypeSchema = z.enum(["basic", "cloze", "mcq", "matching"]);
export type CardType = z.infer<typeof cardTypeSchema>;

export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof difficultySchema>;

export const flashcardSchema = z.object({
  front: z.string().min(1).max(500),
  back: z.string().min(1).max(1000),
  type: cardTypeSchema.default("basic"),
  difficulty: difficultySchema.default("medium"),
  tags: z.array(z.string().min(1).max(40)).max(10).default([])
});

export type Flashcard = z.infer<typeof flashcardSchema>;

export const flashcardListSchema = z.array(flashcardSchema).min(1).max(50);
export type FlashcardList = z.infer<typeof flashcardListSchema>;
