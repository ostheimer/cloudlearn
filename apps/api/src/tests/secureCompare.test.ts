import { describe, expect, it } from "vitest";
import { secureCompare } from "@/lib/secureCompare";

describe("secureCompare", () => {
  it("returns true for identical strings", () => {
    expect(secureCompare("whsec_abc123", "whsec_abc123")).toBe(true);
    expect(secureCompare("", "")).toBe(true);
  });

  it("returns false for different strings of equal length", () => {
    expect(secureCompare("aaaa", "aaab")).toBe(false);
  });

  it("returns false on length mismatch instead of throwing", () => {
    expect(secureCompare("short", "a-much-longer-secret")).toBe(false);
    expect(secureCompare("secret-x", "secret")).toBe(false);
  });

  it("returns false for null/undefined inputs (missing header, unset env)", () => {
    expect(secureCompare(null, "secret")).toBe(false);
    expect(secureCompare(undefined, "secret")).toBe(false);
    expect(secureCompare("secret", null)).toBe(false);
    expect(secureCompare("secret", undefined)).toBe(false);
    // Both missing must NOT be treated as a match.
    expect(secureCompare(null, null)).toBe(false);
    expect(secureCompare(undefined, undefined)).toBe(false);
  });

  it("compares multi-byte UTF-8 content correctly", () => {
    expect(secureCompare("geheim-ü", "geheim-ü")).toBe(true);
    expect(secureCompare("geheim-ü", "geheim-ö")).toBe(false);
  });
});
