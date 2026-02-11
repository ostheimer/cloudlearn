import { beforeEach, describe, expect, it } from "vitest";
import { listBetaFeedback, resetBetaFeedbackStore, submitBetaFeedback } from "@/services/betaFeedbackService";

describe("beta feedback service", () => {
  beforeEach(() => {
    resetBetaFeedbackStore();
  });

  it("stores and filters feedback entries", () => {
    const userId = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";
    submitBetaFeedback({
      userId,
      rating: 5,
      message: "Sehr guter Flow",
      category: "ux"
    });
    submitBetaFeedback({
      userId: "0b25d170-8d32-47f0-9e4a-5631161fb2b4",
      rating: 3,
      message: "Sync war heute langsam",
      category: "performance"
    });

    expect(listBetaFeedback()).toHaveLength(2);
    expect(listBetaFeedback(userId)).toHaveLength(1);
  });
});
