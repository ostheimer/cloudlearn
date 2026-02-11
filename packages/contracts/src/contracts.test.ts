import { describe, expect, it } from "vitest";
import {
  betaFeedbackSchema,
  apiErrorSchema,
  flashcardListSchema,
  reviewRequestSchema,
  scanProcessRequestSchema,
  syncRequestSchema
} from "./index";

describe("contracts", () => {
  it("validates scan requests", () => {
    const parsed = scanProcessRequestSchema.parse({
      userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      extractedText: "Das ist ein kurzer Lerntext.",
      idempotencyKey: "scan-2026-02-09-001"
    });

    expect(parsed.sourceLanguage).toBe("de");
  });

  it("rejects invalid flashcards", () => {
    const result = flashcardListSchema.safeParse([{ front: "", back: "A" }]);
    expect(result.success).toBe(false);
  });

  it("validates reviews and sync operations", () => {
    const review = reviewRequestSchema.parse({
      userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      cardId: "2d0afe28-6be8-46fb-a85a-df88d3db9f5f",
      rating: "good",
      reviewedAt: "2026-02-09T10:20:30.000Z",
      idempotencyKey: "review-001"
    });

    const sync = syncRequestSchema.parse({
      userId: review.userId,
      operations: [
        {
          operationId: "operation-001",
          operationType: "review",
          createdAt: "2026-02-09T10:20:31.000Z",
          payload: review
        }
      ]
    });

    expect(sync.operations).toHaveLength(1);
  });

  it("validates normalized API errors", () => {
    const parsed = apiErrorSchema.parse({
      code: "RATE_LIMITED",
      message: "Rate limit exceeded",
      request_id: "req-00000001"
    });

    expect(parsed.code).toBe("RATE_LIMITED");
  });

  it("validates beta feedback payloads", () => {
    const feedback = betaFeedbackSchema.parse({
      userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      rating: 4,
      message: "Onboarding ist gut, aber der OCR-Editor sollte mehr Hinweise geben.",
      category: "ux"
    });

    expect(feedback.channel).toBe("in_app");
  });
});
