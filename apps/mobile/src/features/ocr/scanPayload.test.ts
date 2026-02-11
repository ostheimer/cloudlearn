import { describe, expect, it } from "vitest";
import { buildScanPayload } from "./scanPayload";

describe("buildScanPayload", () => {
  it("passes edited OCR text in normalized form", () => {
    const payload = buildScanPayload({
      userId: "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a",
      idempotencyKey: "scan-key-ocr-001",
      editedText: "  Ein   OCR-Text\n\n\n mit  Fehlern  ",
      sourceLanguage: "de"
    });

    expect(payload.extractedText).toBe("Ein OCR-Text\n\n mit Fehlern");
    expect(payload.idempotencyKey).toBe("scan-key-ocr-001");
  });
});
