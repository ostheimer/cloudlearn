import { describe, expect, it } from "vitest";
import { resolveRewardedAdOutcome } from "./resolveRewardedAdOutcome";

describe("resolveRewardedAdOutcome (#285)", () => {
  it("treats a null result as failed", () => {
    expect(resolveRewardedAdOutcome(null)).toEqual({
      kind: "failed",
      messageKey: "lp.adFailed",
    });
  });

  it("treats a mock ad as 'not active yet' — never a +0 LP credit", () => {
    // This is exactly what watchAd() returns today (ads not live, #149).
    const outcome = resolveRewardedAdOutcome({
      granted: 0,
      newBalance: 0,
      capReached: false,
      mock: true,
    });
    expect(outcome).toEqual({ kind: "mock", messageKey: "lp.adMockNotActive" });
  });

  it("treats a pending (real ad, SSV) result as pending", () => {
    const outcome = resolveRewardedAdOutcome({
      granted: 0,
      newBalance: 12,
      capReached: false,
      pending: true,
    });
    expect(outcome).toEqual({ kind: "pending", messageKey: "lp.adRewardPending" });
  });

  it("reports the daily cap", () => {
    const outcome = resolveRewardedAdOutcome({
      granted: 0,
      newBalance: 30,
      capReached: true,
    });
    expect(outcome).toEqual({ kind: "capReached", messageKey: "lp.adCapReached" });
  });

  it("passes a real credit through with count and new balance", () => {
    const outcome = resolveRewardedAdOutcome({
      granted: 5,
      newBalance: 42,
      capReached: false,
    });
    expect(outcome).toEqual({
      kind: "granted",
      messageKey: "lp.adRewarded",
      count: 5,
      newBalance: 42,
    });
  });

  it("prefers mock over cap when both are set (mock is checked first)", () => {
    const outcome = resolveRewardedAdOutcome({
      granted: 0,
      newBalance: 0,
      capReached: true,
      mock: true,
    });
    expect(outcome.kind).toBe("mock");
  });
});
