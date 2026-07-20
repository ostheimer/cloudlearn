import { describe, expect, it, vi } from "vitest";
import { finishRateModeRound, REVIEW_CHUNK_SIZE } from "./rateModeRound";

function answers(n: number, correct = true) {
  return Array.from({ length: n }, (_, i) => ({ cardId: `c${i}`, correct }));
}

describe("finishRateModeRound", () => {
  it("meldet jede Antwort und rechnet erst danach ab", async () => {
    const reihenfolge: string[] = [];
    const res = await finishRateModeRound(
      [
        { cardId: "a", correct: true },
        { cardId: "b", correct: false },
      ],
      {
        reportReview: async (cardId, rating) => {
          reihenfolge.push(`review:${cardId}:${rating}`);
        },
        earn: async (count) => {
          reihenfolge.push(`earn:${count}`);
          return { granted: 2, capReached: false };
        },
      }
    );

    // Richtig -> good, falsch -> again. Und die Abrechnung kommt ZULETZT:
    // earnLp zählt serverseitig die eingetroffenen Wiederholungen, käme es
    // zuerst, wäre granted 0 obwohl gelernt wurde (der Fehler aus #397).
    expect(reihenfolge).toEqual(["review:a:good", "review:b:again", "earn:2"]);
    expect(res).toEqual({ granted: 2, capReached: false, reported: 2 });
  });

  it("meldet in Häppchen, statt alles gleichzeitig loszufeuern", async () => {
    // Ohne Aufteilung würden 60 gleichzeitige Anfragen die Bremse auf der
    // Review-Route auslösen (#358) und ein Teil der Antworten wäre still weg.
    let gleichzeitig = 0;
    let maxGleichzeitig = 0;

    await finishRateModeRound(answers(60), {
      reportReview: async () => {
        gleichzeitig += 1;
        maxGleichzeitig = Math.max(maxGleichzeitig, gleichzeitig);
        await Promise.resolve();
        gleichzeitig -= 1;
      },
      earn: async () => ({ granted: 60, capReached: false }),
    });

    expect(maxGleichzeitig).toBeLessThanOrEqual(REVIEW_CHUNK_SIZE);
  });

  it("behält die gemeldeten Antworten, wenn nur die Abrechnung scheitert", async () => {
    // Streak und Statistik hängen an den Wiederholungen und sind wichtiger als
    // die Punkte. Die Oberfläche zeigt dann keine Punkte an, statt eine Zahl
    // zu erfinden.
    const report = vi.fn().mockResolvedValue(undefined);
    const res = await finishRateModeRound(answers(3), {
      reportReview: report,
      earn: async () => {
        throw new Error("Netz weg");
      },
    });

    expect(report).toHaveBeenCalledTimes(3);
    expect(res).toEqual({ granted: 0, capReached: false, reported: 3 });
  });

  it("meldet weiter, auch wenn einzelne Antworten scheitern", async () => {
    const earn = vi.fn().mockResolvedValue({ granted: 1, capReached: false });
    const res = await finishRateModeRound(answers(3), {
      reportReview: async (cardId) => {
        if (cardId === "c1") throw new Error("eine geht daneben");
      },
      earn,
    });

    // Eine gescheiterte Wiederholung darf die Runde nicht abbrechen.
    expect(earn).toHaveBeenCalledWith(3);
    expect(res.granted).toBe(1);
  });

  it("tut nichts bei einer leeren Runde", async () => {
    const report = vi.fn();
    const earn = vi.fn();

    const res = await finishRateModeRound([], { reportReview: report, earn });

    expect(report).not.toHaveBeenCalled();
    expect(earn).not.toHaveBeenCalled(); // sonst 0-Karten-Abrechnung auf dem Server
    expect(res).toEqual({ granted: 0, capReached: false, reported: 0 });
  });
});
