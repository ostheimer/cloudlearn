import { z } from "zod";
import { flashcardListSchema } from "./flashcards";

export const pdfImportRequestSchema = z.object({
  userId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(200),
  fileBase64: z.string().min(100).max(20_000_000),
  idempotencyKey: z.string().min(8).max(128),
  sourceLanguage: z.string().min(2).max(10).default("de"),
  deckId: z.string().uuid().optional(),
});

export type PdfImportRequest = z.infer<typeof pdfImportRequestSchema>;

export const pdfImportResponseSchema = z.object({
  requestId: z.string().min(8),
  model: z.string().min(2),
  fallbackUsed: z.boolean().default(false),
  cards: flashcardListSchema,
  deckTitle: z.string().min(1).max(100).optional(),
  fileName: z.string().min(1).max(200),
  pageCount: z.number().int().positive(),
  extractedCharacters: z.number().int().positive(),
});

export type PdfImportResponse = z.infer<typeof pdfImportResponseSchema>;

export const pdfImportJobSchema = z.object({
  jobId: z.string().min(8),
  userId: z.string().uuid(),
  fileName: z.string().min(1),
  pageCount: z.number().int().positive(),
  status: z.enum(["queued", "processing", "completed", "failed"]),
  retries: z.number().int().nonnegative().default(0)
});

export type PdfImportJob = z.infer<typeof pdfImportJobSchema>;
