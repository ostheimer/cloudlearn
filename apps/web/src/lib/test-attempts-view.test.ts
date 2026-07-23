import { describe, expect, it } from "vitest";

import type { TestAttemptSummary } from "./api";
import {
  examPercentOverShown,
  percent,
  ratePercent,
  relativeDay,
  showsGapNote,
} from "./test-attempts-view";

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
  it("rundet auf ganze Prozent", () => {
    expect(percent(18, 30)).toBe(60);
    expect(percent(12, 25)).toBe(48);
  });
  it("gibt 0 bei 0 Fragen, statt durch null zu teilen", () => {
    expect(percent(0, 0)).toBe(0);
  });
});

describe("examPercentOverShown", () => {
  it("rechnet über GENAU die angezeigten Prüfungen — die Kopfzahl passt zur Liste", () => {
    // Die drei sichtbaren: 12/30, 13/30, 12/25 -> (37/85) = 43,5 -> 44 %.
    const shown = [
      attempt({ questionCount: 30, correctCount: 12 }),
      attempt({ questionCount: 30, correctCount: 13 }),
      attempt({ questionCount: 25, correctCount: 12 }),
    ];
    expect(examPercentOverShown(shown)).toBe(44);
  });

  it("bezieht KEINE stillen Prüfungen dahinter ein (Aufrufer schneidet vorher ab)", () => {
    // Nur wer schon auf drei geschnitten hat, ruft das hier auf. Eine vierte
    // Prüfung würde das Ergebnis verschieben — deshalb schneidet die Komponente
    // VOR dem Aufruf. Hier belegt: über zwei sehr verschiedene Werte kommt der
    // ehrliche gewichtete Schnitt heraus, kein einfacher Mittelwert.
    const shown = [
      attempt({ questionCount: 10, correctCount: 10 }), // 100 %
      attempt({ questionCount: 90, correctCount: 0 }), //   0 %
    ];
    // gewichtet: 10/100 = 10 %, NICHT (100+0)/2 = 50 %.
    expect(examPercentOverShown(shown)).toBe(10);
  });

  it("ist 0 bei leerer Liste", () => {
    expect(examPercentOverShown([])).toBe(0);
  });
});

describe("ratePercent", () => {
  it("nimmt eine 0..1-Rate", () => {
    expect(ratePercent(0.52)).toBe(52);
  });
  it("nimmt auch eine bereits-Prozent-Rate (0..100)", () => {
    expect(ratePercent(52)).toBe(52);
  });
  it("gibt null durch, wenn es keine selbst vergebene Quote gibt", () => {
    expect(ratePercent(null)).toBeNull();
  });
});

describe("showsGapNote", () => {
  it("zeigt den Satz nur, wenn die Prüfung wirklich TIEFER liegt", () => {
    expect(showsGapNote(41, 52)).toBe(true);
  });
  it("schweigt, wenn die Prüfung gleich oder höher ist (Satz wäre falsch)", () => {
    expect(showsGapNote(52, 52)).toBe(false);
    expect(showsGapNote(60, 52)).toBe(false);
  });
  it("schweigt, wenn es keine Vergleichszahl gibt", () => {
    expect(showsGapNote(41, null)).toBe(false);
  });
});

describe("relativeDay (Berliner Zeit)", () => {
  // Fixes „jetzt": 21. Juli 2026, 09:00 UTC = 11:00 Berlin.
  const now = new Date("2026-07-21T09:00:00.000Z");

  it("nennt denselben Tag heute", () => {
    expect(relativeDay("2026-07-21T06:00:00.000Z", now)).toBe("heute");
  });
  it("nennt den Vortag gestern", () => {
    // 20. Juli 12:00 UTC = 14:00 Berlin, eindeutig der Vortag.
    expect(relativeDay("2026-07-20T12:00:00.000Z", now)).toBe("gestern");
  });
  it("nennt ältere Tage als Datum", () => {
    expect(relativeDay("2026-07-16T10:00:00.000Z", now)).toBe("16. Juli");
  });
  it("ordnet späten Abend nach Berliner Zeit dem richtigen Tag zu", () => {
    // 20. Juli 23:30 UTC = 21. Juli 01:30 Berlin -> „heute", nicht „gestern".
    expect(relativeDay("2026-07-20T23:30:00.000Z", now)).toBe("heute");
  });
});
