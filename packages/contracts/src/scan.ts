import { z } from "zod";
import { flashcardListSchema } from "./flashcards";

export const scanProcessRequestSchema = z.object({
  userId: z.string().uuid(),
  extractedText: z.string().min(1).max(20_000),
  idempotencyKey: z.string().min(8).max(128),
  sourceLanguage: z.string().min(2).max(10).default("de"),
  sourceImageUrl: z.string().url().optional(),
  deckId: z.string().uuid().optional()
});

export type ScanProcessRequest = z.infer<typeof scanProcessRequestSchema>;

export const scanProcessResponseSchema = z.object({
  requestId: z.string().min(8),
  model: z.string().min(2),
  fallbackUsed: z.boolean().default(false),
  cards: flashcardListSchema
});

export type ScanProcessResponse = z.infer<typeof scanProcessResponseSchema>;
