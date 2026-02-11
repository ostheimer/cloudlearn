import { describe, expect, it } from "vitest";
import { createAnalyticsEvent } from "@/lib/analytics";

describe("analytics mapping", () => {
  it("creates supported analytics events with required fields", () => {
    const event = createAnalyticsEvent("scan_completed", "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a", {
      cards: 5
    });

    expect(event.event).toBe("scan_completed");
    expect(event.properties.cards).toBe(5);
  });

  it("rejects unsupported event names", () => {
    expect(() =>
      createAnalyticsEvent("unknown_event", "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a")
    ).toThrowError();
  });
});
