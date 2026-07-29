import { isApiError } from "./api";

/**
 * Endgültig verlorene Bewertungen sichtbar machen (#605).
 *
 * Wird eine Karte auf Gerät A gelöscht, während Gerät B sie noch in einer
 * offenen Runde hat, beantwortet der Server das Speichern der Bewertung mit
 * 404 (CARD_NOT_FOUND/DECK_NOT_FOUND). Bis #605 verschluckten alle fünf
 * Lernmodi diesen Fehler — der Ergebnis-Bildschirm behauptete „Runde
 * geschafft", obwohl nichts verbucht war (kein Streak-Tag, keine Statistik,
 * keine Lernpunkte). Diese Helfer teilen sich die drei Bausteine der ehrlichen
 * Antwort: erkennen, beziffern, benennen.
 */

/**
 * Karte oder Deck wurde inzwischen gelöscht — die Bewertung ist ENDGÜLTIG
 * verloren, ein neuer Versuch würde genauso abgelehnt. Bewusst am Status 404
 * festgemacht statt an den Fehlercodes: Der Review-Endpunkt antwortet nur
 * dann mit 404, wenn Karte oder Deck fehlen, und der Status kommt auch bei
 * einer Antwort ohne `code`-Feld an.
 */
export function isCardGone(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

/**
 * Die ehrliche Ergebnis-Zeile (Laras Wortlaut, 29.07.): Sie ergänzt die
 * Runden-Auswertung, ersetzt sie nicht — gelernt wurde ja wirklich, nur das
 * Speichern schlug fehl. `null` bei 0, damit die Zeile ganz verschwindet.
 */
export function unsavedReviewsNotice(count: number): string | null {
  if (count <= 0) return null;
  if (count === 1) {
    return "1 Bewertung konnte nicht gespeichert werden — die Karte wurde inzwischen gelöscht.";
  }
  return `${count} Bewertungen konnten nicht gespeichert werden — die Karten wurden inzwischen gelöscht.`;
}

/**
 * Lernpunkte nur für wirklich gespeicherte Antworten: Von der beanspruchten
 * Menge gehen die endgültig abgelehnten ab. Nie negativ — sollte ein Zähler
 * je auseinanderlaufen, wird lieber gar nichts beansprucht als Unsinn.
 */
export function persistedReviewCount(reviewedCount: number, unsavedCount: number): number {
  return Math.max(0, reviewedCount - unsavedCount);
}
