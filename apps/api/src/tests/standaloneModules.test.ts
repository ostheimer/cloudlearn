import { describe, expect, it } from "vitest";
import { createNewFsrsCard, applyReview } from "@/lib/domain";
import { scanProcessRequestSchema, flashcardListSchema } from "@/lib/contracts";

describe("standalone modules for Vercel deploy", () => {
  it("validates scan request payload", () => {
    const parsed = scanProcessRequestSchema.parse({
      userId: "7e8cd2f6-0a3d-45fa-a0f8-d71d8fcd3e38",
      extractedText: "Ein kurzer OCR-Text",
      idempotencyKey: "scan-key-1234",
      sourceLanguage: "de"
    });

    expect(parsed.sourceLanguage).toBe("de");
  });

  it("validates generated flashcards list", () => {
    const parsed = flashcardListSchema.parse([
      { front: "Frage", back: "Antwort", type: "basic", difficulty: "medium", tags: [] }
    ]);

    expect(parsed).toHaveLength(1);
  });

  it("applies fsrs review transition without throwing", () => {
    const card = createNewFsrsCard();
    const result = applyReview(card, "good", new Date("2026-02-10T09:00:00.000Z"));

    expect(result.card.due).toBeInstanceOf(Date);
    expect(result.log.rating).toBeDefined();
  });
});
