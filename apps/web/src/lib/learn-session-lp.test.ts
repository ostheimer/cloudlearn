import { describe, expect, it } from "vitest";
import { isSessionEarnFinalized, LP_SESSION_MIN_CARDS } from "./learn-session-lp";

describe("isSessionEarnFinalized", () => {
  it("does not finalize below the minimum reviewed cards", () => {
    expect(
      isSessionEarnFinalized({ granted: 5, capReached: false }, LP_SESSION_MIN_CARDS - 1),
    ).toBe(false);
  });

  it("finalizes when LP were granted", () => {
    expect(
      isSessionEarnFinalized({ granted: 5, capReached: false }, LP_SESSION_MIN_CARDS),
    ).toBe(true);
  });

  it("finalizes when the daily cap blocked further grants", () => {
    expect(
      isSessionEarnFinalized({ granted: 0, capReached: true }, LP_SESSION_MIN_CARDS),
    ).toBe(true);
  });

  it("allows retry when reviews may not have been recorded yet", () => {
    expect(
      isSessionEarnFinalized({ granted: 0, capReached: false }, LP_SESSION_MIN_CARDS),
    ).toBe(false);
  });
});
