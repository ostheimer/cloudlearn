/**
 * Meilenstein-Hinweise im Web (#637).
 *
 * Der Auslöser sitzt im gemeinsamen fetch-Wrapper und bekommt JEDE Antwort zu
 * sehen. Diese Tests halten fest, dass er dabei nur auf echte Boni anspringt:
 * Eine Deck-Liste, eine Statistik oder ein Server, der einen unbekannten Bonus
 * meldet, dürfen kein leeres Kästchen erzeugen.
 */

import { describe, expect, it, vi } from "vitest";
import {
  emitMilestones,
  milestoneLabel,
  onMilestones,
  parseMilestones,
  MILESTONE_KEYS,
} from "./milestones";

describe("parseMilestones", () => {
  it("liest die Boni aus einer Antwort", () => {
    expect(
      parseMilestones({
        granted: 8,
        milestones: [
          { key: "first_review", lpGranted: 5 },
          { key: "streak_7", lpGranted: 25 },
        ],
      })
    ).toEqual([
      { key: "first_review", lpGranted: 5 },
      { key: "streak_7", lpGranted: 25 },
    ]);
  });

  it.each([
    ["ohne Feld", { decks: [] }],
    ["mit leerer Liste", { milestones: [] }],
    ["mit null", null],
    ["mit einem Text statt eines Objekts", "ok"],
    ["mit einem Feld, das keine Liste ist", { milestones: 3 }],
  ])("liefert für eine Antwort %s nichts", (_name, payload) => {
    expect(parseMilestones(payload)).toEqual([]);
  });

  it("übergeht einen Bonus, den dieses Web noch nicht kennt", () => {
    // Ein neuerer Server darf hier keinen Hinweis ohne Beschriftung erzeugen.
    expect(
      parseMilestones({
        milestones: [
          { key: "streak_365", lpGranted: 900 },
          { key: "first_deck", lpGranted: 10 },
        ],
      })
    ).toEqual([{ key: "first_deck", lpGranted: 10 }]);
  });

  it.each([0, -5, Number.NaN, "10"])("übergeht %p als Punktzahl", (lpGranted) => {
    expect(parseMilestones({ milestones: [{ key: "first_deck", lpGranted }] })).toEqual([]);
  });
});

describe("milestoneLabel", () => {
  it("hat für jeden bekannten Bonus eine Beschriftung", () => {
    for (const key of MILESTONE_KEYS) {
      expect(milestoneLabel(key).length).toBeGreaterThan(0);
    }
  });

  it("benutzt die Wörter der Lernpunkte-Seite", () => {
    expect(milestoneLabel("first_deck")).toBe("Erstes Deck");
    expect(milestoneLabel("first_review")).toBe("Erste Lernsitzung");
    expect(milestoneLabel("streak_7")).toBe("7 Tage");
  });
});

describe("emitMilestones", () => {
  it("erreicht angemeldete Zuhörer", () => {
    const heard = vi.fn();
    const off = onMilestones(heard);

    emitMilestones([{ key: "first_deck", lpGranted: 10 }]);

    expect(heard).toHaveBeenCalledWith([{ key: "first_deck", lpGranted: 10 }]);
    off();
  });

  it("meldet leere Listen gar nicht erst", () => {
    const heard = vi.fn();
    const off = onMilestones(heard);

    emitMilestones([]);

    expect(heard).not.toHaveBeenCalled();
    off();
  });

  it("schweigt nach dem Abmelden", () => {
    const heard = vi.fn();
    onMilestones(heard)();

    emitMilestones([{ key: "first_deck", lpGranted: 10 }]);

    expect(heard).not.toHaveBeenCalled();
  });

  it("lässt einen fehlerhaften Zuhörer den Aufruf nicht mitreissen", () => {
    // Der API-Aufruf, der den Bonus ausgelöst hat, darf an einem kaputten
    // Hinweis nicht scheitern — der Bonus liegt längst auf dem Konto.
    const off1 = onMilestones(() => {
      throw new Error("kaputt");
    });
    const heard = vi.fn();
    const off2 = onMilestones(heard);

    expect(() => emitMilestones([{ key: "streak_30", lpGranted: 100 }])).not.toThrow();
    expect(heard).toHaveBeenCalled();

    off1();
    off2();
  });
});
