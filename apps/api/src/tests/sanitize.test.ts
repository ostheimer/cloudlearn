import { describe, expect, it } from "vitest";
import { sanitizeFileName } from "@/lib/sanitize";

describe("sanitize file name", () => {
  it("removes unsafe characters", () => {
    const sanitized = sanitizeFileName("../../secret file?.png");
    expect(sanitized).toBe(".._.._secret_file_.png");
  });

  it("limits length", () => {
    const longName = "a".repeat(500);
    expect(sanitizeFileName(longName).length).toBeLessThanOrEqual(120);
  });
});
