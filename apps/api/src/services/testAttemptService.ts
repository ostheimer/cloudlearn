import { HttpError } from "@/lib/http";
import {
  getDeck,
  getDeckCardIds,
  recordTestAttempt,
  TEST_ATTEMPT_DECK_CONFLICT,
} from "@/lib/db";
import { testAttemptSubmitSchema } from "@/lib/contracts";
import { logInfo } from "@/lib/observability";

export interface TestAttemptResult {
  requestId: string;
  id: string;
  deckId: string;
  questionCount: number;
  correctCount: number;
  submittedAt: string;
}

/**
 * Nimmt eine ABGEGEBENE Prüfung entgegen und schreibt eine test_attempts-Zeile.
 *
 * Der Client schickt nur die Antwortliste, nie das Ergebnis. Der Server prüft
 * das Deck, filtert die Antworten gegen die echten Karten des Decks, entdoppelt
 * und zählt selbst — die Zahl auf dem Ergebnisbildschirm entsteht hier, nicht
 * im Body. An ihr hängt nichts (keine LP, kein Lernplan, keine Rangliste), die
 * Filter sind Sorgfalt gegen Unsinn, keine Sicherheitsgrenze.
 *
 * Streak, Statistik-Menge und der Lernplan hängen NICHT an dieser Zeile,
 * sondern an den einzelnen review_logs (mode='test'), die der Client daneben
 * über /cards/:id/review schickt. Hier wird ausschließlich die Prüfung als
 * Einheit protokolliert, damit die „letzten fünf" mit Deck und Datum
 * dastehen können.
 */
export async function submitTestAttempt(
  input: unknown,
  requestId: string
): Promise<TestAttemptResult> {
  const { userId, deckId, idempotencyKey, answers } = testAttemptSubmitSchema.parse(input);

  // Ownership: der Admin-Client umgeht RLS, also Deck per id UND user_id holen.
  // Ein fremdes ODER weich gelöschtes Deck ist von „gibt es nicht" nicht zu
  // unterscheiden (404) — die Antwort verrät nicht, ob ein fremdes Deck existiert.
  const deck = await getDeck(deckId, userId);
  if (!deck) throw new HttpError("Deck not found", 404, "DECK_NOT_FOUND");

  // Nur Antworten zählen, deren Karte nachweislich zu diesem Deck gehört und
  // nicht gelöscht ist — und jede Karte höchstens einmal. Damit kostet ein
  // gefälschtes „30 von 30" mindestens 30 echte Karten in einem echten Deck;
  // aus einem Ein-Karten-Deck ist es nicht herstellbar.
  const validIds = await getDeckCardIds(userId, deckId);
  const seen = new Set<string>();
  let questionCount = 0;
  let correctCount = 0;
  for (const answer of answers) {
    if (!validIds.has(answer.cardId) || seen.has(answer.cardId)) continue;
    seen.add(answer.cardId);
    questionCount += 1;
    if (answer.correct) correctCount += 1;
  }

  // Alles herausgefiltert: keine Geister-Prüfung ohne Bezug zum Deck anlegen.
  if (questionCount === 0) {
    throw new HttpError("No answers matched a card in this deck.", 422, "NO_VALID_ANSWERS");
  }

  let row;
  try {
    row = await recordTestAttempt(userId, deckId, idempotencyKey, questionCount, correctCount);
  } catch (error) {
    // Gleicher Rundenschlüssel, anderes Deck: der Client hat einen Schlüssel
    // wiederverwendet. 409 statt die vorhandene Zeile stillschweigend zu
    // überschreiben — das ist der einzige Weg, auf dem dieses Vorhaben
    // vorhandene Daten zerstören könnte.
    if (error instanceof Error && error.message === TEST_ATTEMPT_DECK_CONFLICT) {
      throw new HttpError(
        "This test round was already recorded for a different deck.",
        409,
        "IDEMPOTENCY_KEY_CONFLICT"
      );
    }
    throw error;
  }

  logInfo("test_attempt_recorded", {
    requestId,
    userId,
    deckId,
    questionCount: row.questionCount,
    correctCount: row.correctCount,
  });

  return {
    requestId,
    id: row.id,
    deckId: row.deckId,
    questionCount: row.questionCount,
    correctCount: row.correctCount,
    submittedAt: row.submittedAt,
  };
}
