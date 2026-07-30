/**
 * Höchstlänge für Deck- und Ordner-Titel (#612). Vorher gab es keine Grenze —
 * tausende Zeichen liessen sich als Titel speichern und sprengten jede Liste.
 * 120 Zeichen reichen für jede echte Überschrift; Langtext gehört in die
 * Beschreibung (500). Die Clients stoppen die Eingabe beim selben Wert
 * (App: src/lib/titleLimit.ts, Web: maxLength an den Namensfeldern).
 *
 * Eigenes Modul statt limits.ts: importCapacity braucht clampTitle, limits.ts
 * importiert aber schon aus importCapacity — das gäbe einen Import-Kreis.
 */
export const TITLE_MAX = 120;

/**
 * Kappen statt abweisen: Scan-/Import-Titel schreibt die KI, und ausgelieferte
 * App-Builds (kein OTA) haben keinen Tipp-Stopp — ein hartes .max() liesse
 * deren Speichern scheitern. Geschnitten wird nach Code-Punkten, damit kein
 * Emoji halbiert wird (ein zerschnittenes Surrogatpaar wäre ungültiges UTF-8,
 * die Datenbank wiese die ganze Zeile ab).
 */
export function clampTitle(title: string): string {
  return [...title].slice(0, TITLE_MAX).join("");
}
