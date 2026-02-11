import { betaFeedbackSchema, type BetaFeedback } from "@/lib/contracts";

const feedbackStore: BetaFeedback[] = [];

export function submitBetaFeedback(input: unknown): BetaFeedback {
  const parsed = betaFeedbackSchema.parse(input);
  feedbackStore.push(parsed);
  return parsed;
}

export function listBetaFeedback(userId?: string): BetaFeedback[] {
  if (!userId) {
    return [...feedbackStore];
  }
  return feedbackStore.filter((entry) => entry.userId === userId);
}

export function resetBetaFeedbackStore(): void {
  feedbackStore.length = 0;
}
