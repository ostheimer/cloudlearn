import { isApiError, reviewCard, type ReviewMode } from "../../lib/api";
import { createReviewSyncOperation, useOfflineQueueStore } from "./offlineQueueStore";

/**
 * Schickt eine Wiederholung und hebt sie auf, wenn das gerade nicht geht.
 *
 * Bis #460 rief jeder Modus `reviewCard(...).catch(() => {})` selbst. Nur
 * Karteikarten und Lückentext reihten Fehlschläge in die Warteschlange ein —
 * Multiple Choice, Zuordnen und Bild-Abdecken warfen sie still weg. Wer im Zug
 * mit wackelndem Netz spielte, verlor damit Streak, Statistik und Lernpunkte,
 * ohne dass der Ergebnis-Bildschirm etwas davon zeigte.
 *
 * Ein Ort statt fünf Kopien: Wer einen neuen Modus baut, ruft diese Funktion
 * und erbt das richtige Verhalten. Genau daran ist es vorher gescheitert.
 */
export function sendReview(input: {
  userId: string;
  cardId: string;
  rating: "again" | "hard" | "good" | "easy";
  mode: ReviewMode;
  reviewDurationMs?: number;
}): Promise<void> {
  const queued = createReviewSyncOperation(input);
  return reviewCard(input.userId, input.cardId, input.rating, queued.payload).then(
    () => undefined,
    (error: unknown) => {
      if (shouldRetryLater(error)) {
        useOfflineQueueStore.getState().enqueue(queued);
      }
    }
  );
}

/**
 * Lohnt ein späterer Versuch?
 *
 * Netzfehler (kein `ApiError`) und Serverfehler ab 500: ja — der Server war
 * nicht erreichbar oder hatte selbst ein Problem, die Antwort ist gültig.
 *
 * 429 („zu viele Anfragen") ist zwar ein 4xx, gehört aber ausdrücklich dazu.
 * Seit #358 bremst der Server Wiederholungen, und ein Nachzügler-Stapel aus dem
 * Offline-Modus kann die Grenze kurz reißen. Diese Antworten wegzuwerfen wäre
 * absurd: Die Bremse sagt „später nochmal", nicht „falsch".
 *
 * Andere 4xx bleiben draußen — eine abgelehnte Karte (404, 401, ungültige
 * Daten) würde beim zweiten Versuch genauso abgelehnt. Sie einzureihen hieße,
 * die Warteschlange mit Unzustellbarem zu verstopfen.
 */
function shouldRetryLater(error: unknown): boolean {
  if (!isApiError(error)) return true;
  return error.status >= 500 || error.status === 429;
}
