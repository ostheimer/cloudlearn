import { z } from "zod";

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

export type ReviewRequest = z.infer<typeof reviewRequestSchema>;

export const fsrsStateSchema = z.enum(["new", "learning", "review", "relearning"]);
export type FsrsState = z.infer<typeof fsrsStateSchema>;

export const reviewResponseSchema = z.object({
  requestId: z.string().min(8),
  cardId: z.string().uuid(),
  nextDueAt: z.string().datetime(),
  stability: z.number().nonnegative(),
  difficulty: z.number().nonnegative(),
  state: fsrsStateSchema
});

export type ReviewResponse = z.infer<typeof reviewResponseSchema>;
