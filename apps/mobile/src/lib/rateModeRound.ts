/**
 * Eine Runde Zuordnen abschließen: Antworten melden, danach die Lernpunkte
 * holen.
 *
 * Multiple Choice und Zuordnen meldeten bisher gar nichts (Issue #406) — kein
 * Streak, keine Statistik, keine Punkte. Auf der Website zählen sie seit #398.
 * Multiple Choice meldet seit #566 jede Antwort sofort (learn-session-lp-
 * Muster in quiz.tsx) — nur Zuordnen sammelt noch bis zum Rundenende, weil
 * dort erst die Auswertung entscheidet, welche Paare als gewusst gelten.
 *
 * Zwei Dinge sind hier nicht verhandelbar:
 *
 * 1. **Erst melden, dann abrechnen.** `earnLp` zählt auf dem Server die bereits
 *    eingetroffenen Wiederholungen. Ruft man es, während die noch unterwegs
 *    sind, kommt `granted: 0` zurück, obwohl gelernt wurde — genau der Fehler,
 *    den PR #397 für Lernen/Üben/Lückentext beschreibt. Deshalb wird hier auf
 *    jedes Häppchen gewartet, bevor abgerechnet wird.
 *
 * 2. **In Häppchen.** Ein `map` ohne `await` feuert bei 40 Fragen 40 Anfragen
 *    gleichzeitig los; die Bremse auf der Review-Route (#358) würde einen Teil
 *    abweisen und die Antworten wären still weg.
 *
 * Bewusst KEIN eigener Wiederhol-Mechanismus: PR #397 bringt dafür
 * `learn-session-lp.ts` mit (wartet und wiederholt, falls die Nutzerin
 * mittendrin den Tab wechselt). Sobald der gemergt ist, sollten Quiz und
 * Zuordnen darauf umgestellt werden, statt hier eine zweite Variante zu
 * pflegen. Hier reicht die Reihenfolge, weil die Abrechnung am RUNDENENDE
 * passiert — der Zeitpunkt gehört uns, nicht dem Zufall.
 */

/** Wie viele Wiederholungen gleichzeitig gemeldet werden (#358). */
export const REVIEW_CHUNK_SIZE = 25;

export interface RateModeAnswer {
  cardId: string;
  correct: boolean;
}

export interface RateModeRoundDeps {
  /** Eine einzelne Wiederholung melden. Fehler werden geschluckt. */
  reportReview: (cardId: string, rating: "good" | "again") => Promise<unknown>;
  /** Lernpunkte für die Runde holen. */
  earn: (cardCount: number) => Promise<{ granted: number; capReached: boolean }>;
}

export interface RateModeRoundResult {
  granted: number;
  capReached: boolean;
  /** Wie viele Antworten gemeldet wurden — auch wenn die Abrechnung scheitert. */
  reported: number;
}

/**
 * Meldet die Antworten und rechnet danach ab.
 *
 * Schlägt das Abrechnen fehl, sind die Wiederholungen trotzdem schon draußen:
 * Streak und Statistik hängen daran und sind wichtiger als die Punkte. Die
 * Rückgabe ist dann `granted: 0` — die Oberfläche zeigt einfach keine Punkte
 * an, statt eine Zahl zu erfinden.
 */
export async function finishRateModeRound(
  answers: RateModeAnswer[],
  deps: RateModeRoundDeps
): Promise<RateModeRoundResult> {
  if (answers.length === 0) {
    return { granted: 0, capReached: false, reported: 0 };
  }

  for (let i = 0; i < answers.length; i += REVIEW_CHUNK_SIZE) {
    const chunk = answers.slice(i, i + REVIEW_CHUNK_SIZE);
    await Promise.allSettled(
      chunk.map((a) => deps.reportReview(a.cardId, a.correct ? "good" : "again"))
    );
  }

  try {
    const res = await deps.earn(answers.length);
    return { granted: res.granted, capReached: res.capReached, reported: answers.length };
  } catch {
    return { granted: 0, capReached: false, reported: answers.length };
  }
}
