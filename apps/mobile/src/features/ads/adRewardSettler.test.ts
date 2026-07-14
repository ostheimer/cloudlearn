import { describe, it, expect, vi } from "vitest";
import { createAdRewardSettler } from "./adRewardSettler";

describe("createAdRewardSettler (#206 Teil B)", () => {
  it("credits the reward only on 'earned'", () => {
    const onSettle = vi.fn();
    createAdRewardSettler(onSettle)("earned");
    expect(onSettle).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("resolves to no-reward for close, error and timeout", () => {
    for (const event of ["closed", "error", "timeout"] as const) {
      const onSettle = vi.fn();
      createAdRewardSettler(onSettle)(event);
      expect(onSettle).toHaveBeenCalledExactlyOnceWith(false);
    }
  });

  it("reproduces the fix: closing before the reward settles (no infinite hang)", () => {
    const onSettle = vi.fn();
    const settle = createAdRewardSettler(onSettle);
    // User dismisses the ad before earning — previously this event was ignored
    // and the promise never resolved. Now it settles to "no reward".
    settle("closed");
    expect(onSettle).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("lets 'earned' win over the 'closed' that follows it", () => {
    const onSettle = vi.fn();
    const settle = createAdRewardSettler(onSettle);
    settle("earned");
    settle("closed");
    expect(onSettle).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("ignores every event after the first terminal one", () => {
    const onSettle = vi.fn();
    const settle = createAdRewardSettler(onSettle);
    settle("closed");
    settle("earned");
    settle("error");
    settle("timeout");
    expect(onSettle).toHaveBeenCalledExactlyOnceWith(false);
  });
});
