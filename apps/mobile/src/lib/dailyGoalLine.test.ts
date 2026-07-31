import { describe, expect, it } from "vitest";
import { dailyGoalLine } from "./dailyGoalLine";

describe("dailyGoalLine", () => {
  it("zeigt nichts ohne gesetztes Ziel", () => {
    expect(dailyGoalLine(0, 5)).toBeNull();
  });

  it("zeigt den Rest bis zum Ziel", () => {
    expect(dailyGoalLine(30, 28)).toBe("Tagesziel: 28/30 Karten — noch 2");
  });

  it("meldet geschafft bei Zielerreichung", () => {
    expect(dailyGoalLine(30, 30)).toBe("Tagesziel: 30/30 Karten — geschafft!");
  });

  it("meldet geschafft auch bei Überschreitung", () => {
    expect(dailyGoalLine(10, 15)).toBe("Tagesziel: 15/10 Karten — geschafft!");
  });
});
