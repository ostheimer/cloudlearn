import { describe, expect, it } from "vitest";
import {
  beginSessionAward,
  getSessionReviewedCount,
  isSessionEarnFinalized,
  LP_SESSION_MIN_CARDS,
  type SessionAwardState,
} from "./learn-session-lp";

describe("LP_SESSION_MIN_CARDS", () => {
  it("bleibt wörtlich 1 — Parität mit App und Server (#563)", () => {
    // apps/api/src/services/lpService.ts: `const CARDS_PER_SESSION_CHUNK = 1;`
    // Der Server rechnet in 1-Karten-Häppchen ab, der Client darf also ab der
    // ersten Wiederholung fragen. Mit 5 gingen kurze Web-Runden leer aus.
    //
    // Wichtig: alle übrigen Tests in dieser Datei rechnen mit der Konstante
    // SELBST (LP_SESSION_MIN_CARDS - 1 usw.) und blieben deshalb auch bei 0
    // grün. 0 hiesse aber: earnLp darf ohne eine einzige Wiederholung feuern.
    // Darum steht die Zahl hier ausgeschrieben.
    expect(LP_SESSION_MIN_CARDS).toBe(1);
  });
});

describe("isSessionEarnFinalized", () => {
  it("does not finalize below the minimum reviewed cards", () => {
    expect(
      isSessionEarnFinalized({ granted: 5, capReached: false }, LP_SESSION_MIN_CARDS - 1),
    ).toBe(false);
  });

  it("finalizes when LP were granted", () => {
    expect(
      isSessionEarnFinalized({ granted: 5, capReached: false }, LP_SESSION_MIN_CARDS),
    ).toBe(true);
  });

  it("finalizes when the daily cap blocked further grants", () => {
    expect(
      isSessionEarnFinalized({ granted: 0, capReached: true }, LP_SESSION_MIN_CARDS),
    ).toBe(true);
  });

  it("allows retry when reviews may not have been recorded yet", () => {
    expect(
      isSessionEarnFinalized({ granted: 0, capReached: false }, LP_SESSION_MIN_CARDS),
    ).toBe(false);
  });
});

describe("getSessionReviewedCount", () => {
  it("counts the just-submitted review before the delayed index update", () => {
    expect(getSessionReviewedCount(0, 1)).toBe(1);
  });
});

describe("beginSessionAward", () => {
  it("lets navigation await an award that is already in flight", async () => {
    const state: SessionAwardState = { finalized: false, inFlight: null };
    let release: (() => void) | undefined;
    const run = new Promise<void>((resolve) => {
      release = resolve;
    });
    let starts = 0;

    const first = beginSessionAward(state, LP_SESSION_MIN_CARDS, () => {
      starts += 1;
      return run;
    });
    const second = beginSessionAward(state, LP_SESSION_MIN_CARDS, () => {
      starts += 1;
      return Promise.resolve();
    });

    expect(second).toBe(first);
    expect(starts).toBe(1);

    release?.();
    await second;
    expect(state.inFlight).toBeNull();
  });
});
