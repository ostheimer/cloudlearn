import { describe, expect, it, beforeEach } from "vitest";
import { consumeScanQuota, resetUsageLimitStore } from "@/lib/usageLimit";

describe("usage limits", () => {
  beforeEach(() => {
    resetUsageLimitStore();
  });

  it("enforces free-tier monthly limits", () => {
    const userId = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";
    expect(consumeScanQuota(userId, "free", 2).allowed).toBe(true);
    expect(consumeScanQuota(userId, "free", 2).allowed).toBe(true);
    expect(consumeScanQuota(userId, "free", 2).allowed).toBe(false);
  });

  it("keeps pro and lifetime unlimited", () => {
    const userId = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";
    expect(consumeScanQuota(userId, "pro", 1).allowed).toBe(true);
    expect(consumeScanQuota(userId, "lifetime", 1).allowed).toBe(true);
  });
});
