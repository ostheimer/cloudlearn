import { z } from "zod";

export const betaFeedbackSchema = z.object({
  userId: z.string().uuid(),
  channel: z.enum(["in_app", "email", "interview"]).default("in_app"),
  rating: z.number().int().min(1).max(5),
  message: z.string().min(3).max(5000),
  category: z.enum(["bug", "ux", "feature", "performance", "other"]).default("other")
});

export type BetaFeedback = z.infer<typeof betaFeedbackSchema>;
