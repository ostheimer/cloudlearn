import { describe, expect, it } from "vitest";
import { createRequestId, sampleOcrTextDe, sampleOcrTextEn } from "./index";

describe("testkit fixtures", () => {
  it("contains German and English OCR samples", () => {
    expect(sampleOcrTextDe.toLocaleLowerCase()).toContain("photosynthese");
    expect(sampleOcrTextEn.toLocaleLowerCase()).toContain("photosynthesis");
  });

  it("creates prefixed request IDs", () => {
    const id = createRequestId("scan");
    expect(id.startsWith("req_scan_")).toBe(true);
  });
});
