import { z } from "zod";
import { flashcardListSchema } from "./flashcards";

export const imageMimeTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const scanProcessRequestSchema = z.object({
  userId: z.string().uuid(),
  extractedText: z.string().min(1).max(20_000).optional(),
  imageBase64: z.string().min(100).max(10_000_000).optional(),
  imageMimeType: imageMimeTypeSchema.optional(),
  idempotencyKey: z.string().min(8).max(128),
  sourceLanguage: z.string().min(2).max(10).default("de"),
  deckId: z.string().uuid().optional()
}).refine(
  (data) => Boolean(data.extractedText) || Boolean(data.imageBase64),
  { message: "Either extractedText or imageBase64 must be provided" }
);

export type ScanProcessRequest = z.infer<typeof scanProcessRequestSchema>;

export const scanProcessResponseSchema = z.object({
  requestId: z.string().min(8),
  model: z.string().min(2),
  fallbackUsed: z.boolean().default(false),
  cards: flashcardListSchema,
  deckTitle: z.string().min(1).max(100).optional()
});

export type ScanProcessResponse = z.infer<typeof scanProcessResponseSchema>;

export const urlImportRequestSchema = z.object({
  userId: z.string().uuid(),
  sourceUrl: z.string().url(),
  idempotencyKey: z.string().min(8).max(128),
  sourceLanguage: z.string().min(2).max(10).default("de"),
  maxImages: z.number().int().min(0).max(8).default(4),
  deckId: z.string().uuid().optional(),
});

export type UrlImportRequest = z.infer<typeof urlImportRequestSchema>;

export const urlImportResponseSchema = z.object({
  requestId: z.string().min(8),
  model: z.string().min(2),
  fallbackUsed: z.boolean().default(false),
  cards: flashcardListSchema,
  deckTitle: z.string().min(1).max(100).optional(),
  sourceUrl: z.string().url(),
  imagesUsed: z.number().int().nonnegative().default(0),
});

export type UrlImportResponse = z.infer<typeof urlImportResponseSchema>;
