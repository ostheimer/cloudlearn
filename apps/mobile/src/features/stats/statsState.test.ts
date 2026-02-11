import { beforeEach, describe, expect, it } from "vitest";
import { useStatsState } from "./statsState";

describe("stats state", () => {
  beforeEach(() => {
    useStatsState.setState({
      stats: {
        retentionRate: 0.9,
        reviewCompletionRate: 0.65,
        streakDays: 3
      }
    });
  });

  it("updates dashboard stats", () => {
    useStatsState.getState().updateStats({ streakDays: 7 });
    expect(useStatsState.getState().stats.streakDays).toBe(7);
  });
});
