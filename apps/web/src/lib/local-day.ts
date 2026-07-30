/**
 * „Heute" für Streak-Vergleiche — in DERSELBEN Zeitzone, in der der Server
 * seine Streak-Tage stempelt (#612).
 *
 * Vorher rechnete der Browser mit seiner eigenen Zeitzone. Am selben Ort ist
 * das dasselbe; auf Reisen (oder mit umgestellter Rechner-Uhr) lief es
 * auseinander: Der Server sagt „gelernt am 30.07." (Berlin), der Browser steht
 * schon auf dem 31.07. — der Streak-Kalender setzte den „heute"-Rahmen dann um
 * einen Tag daneben.
 *
 * Spiegelt apps/api/src/lib/localDay.ts (USER_TIMEZONE) — bei Änderungen dort
 * muss diese Datei mitziehen. App-Gegenstück: apps/mobile/src/lib/localDay.ts.
 */

/** Zeitzone, in der der Server Streak-Tage und Tageslimits abgrenzt. */
export const USER_TIMEZONE = "Europe/Berlin";

/**
 * Kalenderdatum (YYYY-MM-DD) in der Server-Zeitzone. `now` ist injizierbar,
 * damit die Tagesgrenze testbar bleibt.
 */
export function todayLocal(now: Date = new Date()): string {
  // sv-SE rendert Daten als YYYY-MM-DD — dasselbe Format wie die Server-Tage.
  return now.toLocaleDateString("sv-SE", { timeZone: USER_TIMEZONE });
}
