import { describe, expect, it } from "vitest";

import type { TestAttemptSummary } from "./api";
import {
  examPercentOverShown,
  percent,
  ratePercent,
  relativeDay,
  showsGapNote,
} from "./testAttemptsView";

const attempt = (over: Partial<TestAttemptSummary>): TestAttemptSummary => ({
  id: "x",
  deckId: "d",
  deckTitle: "Deck",
  questionCount: 30,
  correctCount: 15,
  submittedAt: "2026-07-20T10:00:00.000Z",
  ...over,
});

describe("percent", () => {
  it("rundet auf ganze Prozent, 0 bei 0 Fragen", () => {
    expect(percent(18, 30)).toBe(60);
    expect(percent(0, 0)).toBe(0);
  });
});

describe("examPercentOverShown", () => {
  it("rechnet gewichtet über die angezeigten Prüfungen (passt zur Liste)", () => {
    const shown = [
      attempt({ questionCount: 30, correctCount: 12 }),
      attempt({ questionCount: 30, correctCount: 13 }),
      attempt({ questionCount: 25, correctCount: 12 }),
    ];
    expect(examPercentOverShown(shown)).toBe(44);
  });
  it("gewichtet nach Fragen, nicht als einfacher Mittelwert", () => {
    expect(examPercentOverShown([
      attempt({ questionCount: 10, correctCount: 10 }),
      attempt({ questionCount: 90, correctCount: 0 }),
    ])).toBe(10);
  });
  it("ist 0 bei leerer Liste", () => {
    expect(examPercentOverShown([])).toBe(0);
  });
});

describe("ratePercent", () => {
  it("nimmt 0..1 und 0..100, gibt null durch", () => {
    expect(ratePercent(0.52)).toBe(52);
    expect(ratePercent(52)).toBe(52);
    expect(ratePercent(null)).toBeNull();
    expect(ratePercent(undefined)).toBeNull();
  });
});

describe("showsGapNote", () => {
  it("nur wenn die Prüfung wirklich tiefer liegt", () => {
    expect(showsGapNote(41, 52)).toBe(true);
    expect(showsGapNote(52, 52)).toBe(false);
    expect(showsGapNote(60, 52)).toBe(false);
    expect(showsGapNote(41, null)).toBe(false);
  });
});

describe("relativeDay (Berliner Zeit)", () => {
  const now = new Date("2026-07-21T09:00:00.000Z");
  it("heute / gestern / Datum", () => {
    expect(relativeDay("2026-07-21T06:00:00.000Z", now)).toBe("heute");
    expect(relativeDay("2026-07-20T12:00:00.000Z", now)).toBe("gestern");
    expect(relativeDay("2026-07-16T10:00:00.000Z", now)).toBe("16. Juli");
  });
  it("ordnet späten Abend nach Berliner Zeit dem Folgetag zu", () => {
    // 20. Juli 23:30 UTC = 21. Juli 01:30 Berlin -> heute.
    expect(relativeDay("2026-07-20T23:30:00.000Z", now)).toBe("heute");
  });
});
