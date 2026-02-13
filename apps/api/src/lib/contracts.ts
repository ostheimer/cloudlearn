import { z } from "zod";

export const cardTypeSchema = z.enum(["basic", "cloze", "mcq", "matching"]);
export const difficultySchema = z.enum(["easy", "medium", "hard"]);

export const flashcardSchema = z.object({
  front: z.string().min(1).max(500),
  back: z.string().min(1).max(1000),
  type: cardTypeSchema.default("basic"),
  difficulty: difficultySchema.default("medium"),
  tags: z.array(z.string().min(1).max(40)).max(10).default([])
});

export type Flashcard = z.infer<typeof flashcardSchema>;
export const flashcardListSchema = z.array(flashcardSchema).min(1).max(50);

export const scanProcessRequestSchema = z.object({
  userId: z.string().uuid(),
  extractedText: z.string().min(1).max(20_000).optional(),
  imageBase64: z.string().min(100).max(10_000_000).optional(),
  imageMimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
  idempotencyKey: z.string().min(8).max(128),
  sourceLanguage: z.string().min(2).max(10).default("de"),
  sourceImageUrl: z.string().url().optional(),
  deckId: z.string().uuid().optional()
}).refine(
  (data) => Boolean(data.extractedText) || Boolean(data.imageBase64),
  { message: "Either extractedText or imageBase64 must be provided" }
);

export const scanProcessResponseSchema = z.object({
  requestId: z.string().min(8),
  model: z.string().min(2),
  fallbackUsed: z.boolean().default(false),
  cards: flashcardListSchema,
  deckTitle: z.string().min(1).max(100).optional()
});

export type ScanProcessResponse = z.infer<typeof scanProcessResponseSchema>;

export const reviewRatingSchema = z.enum(["again", "hard", "good", "easy"]);
export type ReviewRating = z.infer<typeof reviewRatingSchema>;

export const reviewRequestSchema = z.object({
  userId: z.string().uuid(),
  cardId: z.string().uuid(),
  rating: reviewRatingSchema,
  reviewedAt: z.string().datetime(),
  reviewDurationMs: z.number().int().nonnegative().max(120_000).optional(),
  idempotencyKey: z.string().min(8).max(128)
});

export const fsrsStateSchema = z.enum(["new", "learning", "review", "relearning"]);

export const reviewResponseSchema = z.object({
  requestId: z.string().min(8),
  cardId: z.string().uuid(),
  nextDueAt: z.string().datetime(),
  stability: z.number().nonnegative(),
  difficulty: z.number().nonnegative(),
  state: fsrsStateSchema
});

export type ReviewResponse = z.infer<typeof reviewResponseSchema>;

export const operationTypeSchema = z.enum(["review", "card_update", "deck_update", "delete"]);

export const syncOperationSchema = z.object({
  operationId: z.string().min(8).max(128),
  operationType: operationTypeSchema,
  createdAt: z.string().datetime(),
  payload: z.union([
    reviewRequestSchema,
    z.object({ cardId: z.string().uuid(), front: z.string().min(1), back: z.string().min(1) }),
    z.object({ deckId: z.string().uuid(), title: z.string().min(1) }),
    z.object({ entity: z.enum(["card", "deck"]), entityId: z.string().uuid() })
  ])
});

export const syncRequestSchema = z.object({
  userId: z.string().uuid(),
  operations: z.array(syncOperationSchema).max(500)
});

export const syncResponseSchema = z.object({
  requestId: z.string().min(8),
  acceptedOperationIds: z.array(z.string()),
  rejectedOperationIds: z.array(z.string()),
  serverTimestamp: z.string().datetime()
});

export type SyncResponse = z.infer<typeof syncResponseSchema>;

export const subscriptionTierSchema = z.enum(["free", "pro", "lifetime"]);
export const subscriptionStatusSchema = z.object({
  userId: z.string().uuid(),
  tier: subscriptionTierSchema,
  isActive: z.boolean(),
  expiresAt: z.string().datetime().nullable()
});

export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const revenueCatWebhookSchema = z.object({
  event: z.object({
    app_user_id: z.string(),
    type: z.string(),
    entitlement_ids: z.array(z.string()).optional(),
    expiration_at_ms: z.number().int().nullable().optional()
  })
});

export type RevenueCatWebhook = z.infer<typeof revenueCatWebhookSchema>;

export const betaFeedbackSchema = z.object({
  userId: z.string().uuid(),
  channel: z.enum(["in_app", "email", "interview"]).default("in_app"),
  rating: z.number().int().min(1).max(5),
  message: z.string().min(3).max(5000),
  category: z.enum(["bug", "ux", "feature", "performance", "other"]).default("other")
});

export type BetaFeedback = z.infer<typeof betaFeedbackSchema>;

export const pdfImportJobSchema = z.object({
  jobId: z.string().min(8),
  userId: z.string().uuid(),
  fileName: z.string().min(1),
  pageCount: z.number().int().positive(),
  status: z.enum(["queued", "processing", "completed", "failed"]),
  retries: z.number().int().nonnegative().default(0)
});

export type PdfImportJob = z.infer<typeof pdfImportJobSchema>;
