import { describe, expect, it } from "vitest";
import {
  betaFeedbackSchema,
  apiErrorSchema,
  flashcardListSchema,
  reviewRequestSchema,
  scanProcessRequestSchema,
  syncRequestSchema,
  urlImportRequestSchema,
  pdfImportRequestSchema,
  TIER_LIMITS,
  getLimitsForTier,
  LP_EARN_RULES,
  lpCostForFeature,
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

  it("validates URL import requests with default image limit", () => {
    const parsed = urlImportRequestSchema.parse({
      userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      sourceUrl: "https://example.com/components",
      idempotencyKey: "url-import-2026-02-28-001",
    });

    expect(parsed.maxImages).toBe(4);
    expect(parsed.sourceLanguage).toBe("de");
  });

  it("validates PDF import requests", () => {
    const parsed = pdfImportRequestSchema.parse({
      userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      fileName: "Biologie Skript.pdf",
      fileBase64: "A".repeat(200),
      idempotencyKey: "pdf-import-2026-03-28-001",
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

describe("featureGates", () => {
  it("free tier has finite deck and card limits", () => {
    const limits = getLimitsForTier("free");
    // #411: von 10/100 angehoben — ein Kapitel-Scan erzeugt heute 100+ Karten.
    expect(limits.maxDecks).toBe(20);
    expect(limits.maxCardsPerDeck).toBe(150);
  });

  it("free tier has LP costs for AI features", () => {
    const limits = getLimitsForTier("free");
    expect(limits.lpCostAiScan).toBeGreaterThan(0);
    expect(limits.lpCostUrlImport).toBeGreaterThan(0);
    expect(limits.lpCostPdfImport).toBeGreaterThan(0);
  });

  it("free tier blocks premium features", () => {
    const limits = getLimitsForTier("free");
    expect(limits.pdfImport).toBe(false);
    expect(limits.imageOcclusion).toBe(false);
    expect(limits.offlineDownload).toBe(false);
    expect(limits.adFree).toBe(false);
  });

  it("pro tier has higher deck and card limits", () => {
    const limits = getLimitsForTier("pro");
    expect(limits.maxDecks).toBe(500);
    expect(limits.maxCardsPerDeck).toBe(2000);
  });

  it("pro tier includes monthly LP grant", () => {
    const limits = getLimitsForTier("pro");
    expect(limits.lpGrantPerMonth).toBeGreaterThan(0);
  });

  it("pro tier enables all premium features", () => {
    const limits = getLimitsForTier("pro");
    expect(limits.pdfImport).toBe(true);
    expect(limits.imageOcclusion).toBe(true);
    expect(limits.offlineDownload).toBe(true);
    expect(limits.adFree).toBe(true);
  });

  it("pro tier has lower LP costs than free", () => {
    const free = getLimitsForTier("free");
    const pro = getLimitsForTier("pro");
    expect(pro.lpCostAiScan).toBeLessThan(free.lpCostAiScan);
    expect(pro.lpCostUrlImport).toBeLessThan(free.lpCostUrlImport);
  });

  it("lifetime tier matches paid feature access", () => {
    const limits = getLimitsForTier("lifetime");
    expect(limits.pdfImport).toBe(true);
    expect(limits.imageOcclusion).toBe(true);
    expect(limits.offlineDownload).toBe(true);
    expect(limits.adFree).toBe(true);
  });

  it("LP earn rules are defined and positive", () => {
    expect(LP_EARN_RULES.perReviewSession).toBeGreaterThan(0);
    expect(LP_EARN_RULES.streakDay7).toBeGreaterThan(LP_EARN_RULES.perReviewSession);
    expect(LP_EARN_RULES.streakDay100).toBeGreaterThan(LP_EARN_RULES.streakDay30);
  });

  it("lpCostForFeature returns correct cost per tier", () => {
    expect(lpCostForFeature("free", "aiScan")).toBe(TIER_LIMITS.free.lpCostAiScan);
    expect(lpCostForFeature("pro", "pdfImport")).toBe(TIER_LIMITS.pro.lpCostPdfImport);
  });

  it("TIER_LIMITS contains free, pro and lifetime", () => {
    expect(Object.keys(TIER_LIMITS)).toEqual(["free", "pro", "lifetime"]);
  });
});
