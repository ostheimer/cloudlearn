import { beforeEach, describe, expect, it } from "vitest";
import { useUsageStore } from "./usageStore";

describe("usageStore.addLp", () => {
  beforeEach(() => {
    useUsageStore.getState().reset();
  });

  it("adds the grant to the current balance", () => {
    useUsageStore.getState().setUsage({ lpBalance: 10 });
    useUsageStore.getState().addLp(3);
    expect(useUsageStore.getState().lpBalance).toBe(13);
  });

  it("bases the new total on the freshest balance, not a stale snapshot", () => {
    // Reproduces the milestone-toast bug: the balance changes from elsewhere
    // AFTER a caller captured it. addLp reads the store itself, so the grant
    // must land on the fresh value (5), never on the captured one (10).
    useUsageStore.getState().setUsage({ lpBalance: 10 });
    // Something else moves the balance (e.g. a feature spend) in the meantime.
    useUsageStore.getState().setUsage({ lpBalance: 5 });
    useUsageStore.getState().addLp(3);
    expect(useUsageStore.getState().lpBalance).toBe(8);
  });

  it("ignores non-positive grants", () => {
    useUsageStore.getState().setUsage({ lpBalance: 10 });
    useUsageStore.getState().addLp(0);
    useUsageStore.getState().addLp(-4);
    expect(useUsageStore.getState().lpBalance).toBe(10);
  });
});
