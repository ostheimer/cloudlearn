/**
 * rateLimitPerMinuteForTier (#607): Vorher prüften vier Routen wörtlich
 * `plan === "pro"` — Lifetime-Käufer (89,99 €) fielen damit auf das
 * Free-Limit. Bezahlt ist bezahlt: pro UND lifetime bekommen das Pro-Limit.
 */

import { describe, expect, it } from "vitest";
import { rateLimitPerMinuteForTier } from "@/lib/rateLimit";

const ENV = { RATE_LIMIT_FREE_PER_MINUTE: 60, RATE_LIMIT_PRO_PER_MINUTE: 240 };

describe("rateLimitPerMinuteForTier", () => {
  it("gives free accounts the free limit", () => {
    expect(rateLimitPerMinuteForTier("free", ENV)).toBe(60);
  });

  it("gives pro accounts the pro limit", () => {
    expect(rateLimitPerMinuteForTier("pro", ENV)).toBe(240);
  });

  it("gives lifetime accounts the pro limit, not the free one", () => {
    expect(rateLimitPerMinuteForTier("lifetime", ENV)).toBe(240);
  });
});
