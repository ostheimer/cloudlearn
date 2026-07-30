/**
 * Nachladen beim Zurückkehren in den Tab (#610). Getestet wird die Logik, die
 * wirklich schiefgehen kann: Ein Nachladen, während der Tab noch versteckt
 * ist, wäre verschwendet; und ohne Bremse löst Hin- und Herklicken zwischen
 * zwei Fenstern eine Anfrage nach der anderen aus.
 *
 * Der Hook selbst braucht React; hier läuft dieselbe Entscheidung als reine
 * Funktion, damit sie ohne Renderer prüfbar bleibt.
 */

import { describe, expect, it } from "vitest";

/** Nachbau der Entscheidung aus use-refresh-on-focus.ts. */
function shouldRefresh(
  visibility: DocumentVisibilityState,
  now: number,
  lastRun: number,
  minIntervalMs = 30_000
): boolean {
  if (visibility !== "visible") return false;
  return now - lastRun >= minIntervalMs;
}

describe("shouldRefresh", () => {
  it("lädt nicht nach, solange der Tab versteckt ist", () => {
    expect(shouldRefresh("hidden", 100_000, 0)).toBe(false);
  });

  it("lädt beim ersten Zurückkommen sofort nach (Bremse startet abgelaufen)", () => {
    // `lastRun` startet auf 0, die echte Uhr steht bei Milliarden — die erste
    // Rückkehr liegt also immer außerhalb des Bremsfensters.
    expect(shouldRefresh("visible", Date.parse("2026-07-30T09:00:00.000Z"), 0)).toBe(true);
  });

  it("bremst schnelles Hin- und Herklicken", () => {
    const lastRun = 100_000;
    expect(shouldRefresh("visible", lastRun + 1_000, lastRun)).toBe(false);
    expect(shouldRefresh("visible", lastRun + 29_999, lastRun)).toBe(false);
  });

  it("lädt wieder nach, sobald das Fenster abgelaufen ist", () => {
    const lastRun = 100_000;
    expect(shouldRefresh("visible", lastRun + 30_000, lastRun)).toBe(true);
    expect(shouldRefresh("visible", lastRun + 60_000, lastRun)).toBe(true);
  });

  it("achtet auf ein abweichendes Bremsfenster", () => {
    expect(shouldRefresh("visible", 5_000, 0, 10_000)).toBe(false);
    expect(shouldRefresh("visible", 10_000, 0, 10_000)).toBe(true);
  });
});
