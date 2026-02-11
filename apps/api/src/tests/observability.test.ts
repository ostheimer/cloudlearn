import { describe, expect, it } from "vitest";
import { resolveRequestId, withRequestIdHeaders } from "@/lib/observability";

describe("observability", () => {
  it("reuses incoming request id", () => {
    const headers = new Headers();
    headers.set("x-request-id", "req-fixed");
    expect(resolveRequestId(headers)).toBe("req-fixed");
  });

  it("creates request-id headers for responses", () => {
    const headers = withRequestIdHeaders("req-123");
    expect(headers.get("x-request-id")).toBe("req-123");
  });
});
