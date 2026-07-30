/**
 * Meilenstein-Hinweise in der App (#637).
 *
 * Der Verteiler hängt im gemeinsamen fetch-Wrapper und sieht JEDE Antwort.
 * Diese Tests halten fest, dass er nur auf echte Boni anspringt — eine
 * Kartenliste oder ein neuerer Server mit einem unbekannten Bonus dürfen keinen
 * Toast ohne Text erzeugen.
 */

import { describe, expect, it, vi } from "vitest";
import {
  emitMilestones,
  isStreakMilestone,
  onMilestones,
  parseMilestones,
} from "./milestoneBus";

describe("parseMilestones", () => {
  it("liest die Boni aus einer Antwort", () => {
    expect(
      parseMilestones({
        granted: 8,
        milestones: [
          { key: "first_review", lpGranted: 5 },
          { key: "streak_30", lpGranted: 100 },
        ],
      })
    ).toEqual([
      { key: "first_review", lpGranted: 5 },
      { key: "streak_30", lpGranted: 100 },
    ]);
  });

  it.each([
    ["ohne Feld", { cards: [] }],
    ["mit leerer Liste", { milestones: [] }],
    ["mit null", null],
    ["mit einem Feld, das keine Liste ist", { milestones: "first_deck" }],
  ])("liefert für eine Antwort %s nichts", (_name, payload) => {
    expect(parseMilestones(payload)).toEqual([]);
  });

  it("übergeht einen Bonus, den diese App-Version noch nicht kennt", () => {
    expect(
      parseMilestones({ milestones: [{ key: "streak_365", lpGranted: 900 }] })
    ).toEqual([]);
  });

  it("übergeht Einträge ohne echte Punktzahl", () => {
    expect(
      parseMilestones({
        milestones: [
          { key: "first_deck", lpGranted: 0 },
          { key: "first_review", lpGranted: 5 },
        ],
      })
    ).toEqual([{ key: "first_review", lpGranted: 5 }]);
  });
});

describe("isStreakMilestone", () => {
  it("trennt die grosse Feier von den kleinen Hinweisen", () => {
    expect(isStreakMilestone("streak_7")).toBe(true);
    expect(isStreakMilestone("streak_100")).toBe(true);
    expect(isStreakMilestone("first_deck")).toBe(false);
    expect(isStreakMilestone("first_review")).toBe(false);
  });
});

describe("emitMilestones", () => {
  it("erreicht angemeldete Zuhörer und schweigt nach dem Abmelden", () => {
    const heard = vi.fn();
    const off = onMilestones(heard);

    emitMilestones([{ key: "first_deck", lpGranted: 10 }]);
    off();
    emitMilestones([{ key: "first_review", lpGranted: 5 }]);

    expect(heard).toHaveBeenCalledTimes(1);
    expect(heard).toHaveBeenCalledWith([{ key: "first_deck", lpGranted: 10 }]);
  });

  it("lässt einen fehlerhaften Zuhörer den Netzaufruf nicht mitreissen", () => {
    const off = onMilestones(() => {
      throw new Error("kaputt");
    });

    expect(() => emitMilestones([{ key: "streak_7", lpGranted: 25 }])).not.toThrow();
    off();
  });
});
