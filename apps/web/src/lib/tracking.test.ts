import { describe, expect, it } from "vitest";
import { buildConversionPayload } from "./tracking";

describe("conversion tracking", () => {
  it("builds payload with timestamp", () => {
    const payload = buildConversionPayload({ event: "cta_click", source: "hero" });
    expect(payload.event).toBe("cta_click");
    expect(payload.source).toBe("hero");
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
