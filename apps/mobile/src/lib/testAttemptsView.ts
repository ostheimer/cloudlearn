// Reine Ansichts-Logik für den Prüfungs-Bereich, aus der Karte herausgezogen,
// damit sie ohne Rendern testbar ist. Spiegelbild von
// apps/web/src/lib/test-attempts-view.ts (Web und App teilen keine Lib, wie bei
// api.ts) — bei Änderungen beide Seiten anfassen.

import type { TestAttemptSummary } from "./api";

/** Wie viele Prüfungen die Liste zeigt (Lara am 23.07.: drei statt fünf). */
export const TEST_ATTEMPTS_SHOWN = 3;

/** Prozentwert einer Prüfung, auf ganze Prozent gerundet (0 bei 0 Fragen). */
export function percent(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

/**
 * „heute" / „gestern" für frische Tage, sonst „20. Juli". Gerechnet in Berliner
 * Zeit (der Server stempelt submitted_at in UTC). `now` ist injizierbar, damit
 * die heute/gestern-Grenze testbar bleibt.
 */
export function relativeDay(iso: string, now: Date = new Date()): string {
  const tz = "Europe/Berlin";
  const asDay = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: tz }); // YYYY-MM-DD
  const day = asDay(new Date(iso));
  if (day === asDay(now)) return "heute";
  if (day === asDay(new Date(now.getTime() - 86_400_000))) return "gestern";
  return new Date(iso).toLocaleDateString("de-DE", { timeZone: tz, day: "numeric", month: "long" });
}

/**
 * Kopfzahl „in Prüfungen" über GENAU die angezeigten Prüfungen (nicht über die
 * stillen dahinter). So passt sie zur Summe der sichtbaren Zeilen.
 */
export function examPercentOverShown(shown: TestAttemptSummary[]): number {
  const questions = shown.reduce((sum, a) => sum + a.questionCount, 0);
  const correct = shown.reduce((sum, a) => sum + a.correctCount, 0);
  return percent(correct, questions);
}

/** Rate (0..1 ODER 0..100) einheitlich als ganze Prozent, oder null. */
export function ratePercent(rate: number | null | undefined): number | null {
  if (rate == null) return null;
  return Math.round(rate <= 1 ? rate * 100 : rate);
}

/**
 * Der Einordnungs-Satz erscheint nur, wenn die Prüfung wirklich UNTER der
 * selbst vergebenen Quote liegt.
 */
export function showsGapNote(examPct: number, selfPct: number | null): boolean {
  return selfPct != null && examPct < selfPct;
}
