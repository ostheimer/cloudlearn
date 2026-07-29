import { describe, expect, it } from "vitest";
import { accColor } from "./accuracy-color";

describe("accColor", () => {
  it("uses the stats thresholds: below 60 % red, below 80 % amber, else green", () => {
    expect(accColor(0)).toBe("#e2504a");
    expect(accColor(0.599)).toBe("#e2504a");
    expect(accColor(0.6)).toBe("#d97706");
    expect(accColor(0.799)).toBe("#d97706");
    expect(accColor(0.8)).toBe("#16a34a");
    expect(accColor(1)).toBe("#16a34a");
  });

  it("no longer mistakes 1 % for 100 % (#595) — percent callers divide by 100 first", () => {
    // The old rate-or-percent guess turned the test panel's accColor(1) into
    // green; with the 0..1 contract, 1 % arrives as 0.01 and stays red.
    expect(accColor(1 / 100)).toBe("#e2504a");
  });

  it("treats a full 0..1 rate as 100 %, not as 1 %", () => {
    expect(accColor(1)).toBe(accColor(0.99));
  });
});
