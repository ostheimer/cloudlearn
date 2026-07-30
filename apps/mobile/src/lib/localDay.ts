/**
 * „Heute" für Streak-Vergleiche — in DERSELBEN Zeitzone, in der der Server
 * seine Streak-Tage stempelt (#612).
 *
 * Vorher rechneten die Clients mit der Geräte-Zeitzone. Für ein Handy in
 * Deutschland ist das dasselbe; auf Reisen (oder mit umgestellter Geräte-Uhr)
 * lief es auseinander: Der Server sagt „zuletzt gelernt am 30.07." (Berlin),
 * das Gerät steht schon auf dem 31.07. — die Startseite behauptete dann, heute
 * sei noch nicht gelernt worden, und die Flamme blieb kalt, obwohl der Streak
 * längst gefüttert war. Umgekehrt in der Gegenrichtung: ein Häkchen für einen
 * Tag, den der Server noch gar nicht angebrochen hat.
 *
 * Spiegelt apps/api/src/lib/localDay.ts (USER_TIMEZONE) — bei Änderungen dort
 * muss diese Datei mitziehen. Web-Gegenstück: apps/web/src/lib/local-day.ts.
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
