/**
 * Welcher „Weitermachen"-Stand gilt: der von diesem Gerät oder der aus dem
 * Konto? (#610)
 *
 * Beide können brauchbar sein und trotzdem verschiedene Positionen meinen —
 * genau dann, wenn zwischendurch auf einem anderen Gerät gelernt wurde. Der
 * NEUERE gewinnt: Er kennt die zuletzt wirklich bewerteten Karten, und genau
 * deren doppelte Bewertung soll das Ganze verhindern.
 *
 * Ein Stand ohne Zeitstempel stammt von vor diesem Feld und gilt als älter als
 * jeder Stand mit Zeitstempel — was stimmt, denn den Zeitstempel schreiben
 * beide Seiten seit derselben Version.
 *
 * Bewusst hier und nicht in den Bildschirmen: Die Regel ist kurz, aber
 * folgenreich, und beide Plattformen müssen sich gleich entscheiden.
 */

export interface TimestampedProgress {
  savedAt?: string | undefined;
}

/** Millisekunden eines Zeitstempels; -1 für fehlend oder unlesbar. */
function stampOf(entry: TimestampedProgress | null): number {
  if (!entry?.savedAt) return -1;
  const ms = new Date(entry.savedAt).getTime();
  return Number.isFinite(ms) ? ms : -1;
}

/**
 * Den maßgeblichen Stand wählen. Beide Seiten dürfen null sein (nichts
 * gemerkt, Netz weg, Speicher gesperrt); bei Gleichstand gewinnt der
 * Konto-Stand, weil er die geräteübergreifende Sicht ist.
 */
export function pickNewerProgress<L extends TimestampedProgress, S extends TimestampedProgress>(
  local: L | null,
  server: S | null
): L | S | null {
  if (!local) return server;
  if (!server) return local;
  return stampOf(local) > stampOf(server) ? local : server;
}
