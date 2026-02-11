import { beforeEach, describe, expect, it } from "vitest";
import { usePaywallState } from "./paywallState";

describe("paywall state", () => {
  beforeEach(() => {
    usePaywallState.setState({ tier: "free", scansUsedThisMonth: 0 });
  });

  it("blocks free users after limit", () => {
    for (let i = 0; i < 10; i += 1) {
      expect(usePaywallState.getState().consumeScan()).toBe(true);
    }
    expect(usePaywallState.getState().consumeScan()).toBe(false);
  });

  it("allows pro users without scan cap", () => {
    usePaywallState.getState().upgrade("pro");
    for (let i = 0; i < 20; i += 1) {
      expect(usePaywallState.getState().consumeScan()).toBe(true);
    }
  });
});
