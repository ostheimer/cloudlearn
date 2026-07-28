import type { ReviewRating } from "./api";

export interface BufferedReview {
  cardId: string;
  rating: ReviewRating;
}

/**
 * Bewertungen werden einen Schritt zurückgehalten statt sofort geschickt —
 * das Web-Gegenstück zu apps/mobile/src/features/review/reviewSendBuffer.ts
 * (#283-Muster). Die jüngste Bewertung bleibt hier liegen und geht erst raus,
 * wenn die Lernerin wirklich weitergezogen ist (nächste Karte bewertet, Runde
 * fertig, Ansicht verlassen). Nur so kann der Zurück-Pfeil eine noch nicht
 * gesendete Bewertung verwerfen, statt eine zweite, doppelt zählende
 * Wiederholung abzufeuern.
 *
 * Bewusst rein und ohne Netzwerk: Jede Methode gibt zurück, was JETZT
 * gesendet werden soll (oder null), der Aufrufer schickt selbst. So bleibt
 * die Entscheidung — der Teil, der das Doppelzählen verhindert — trivial
 * testbar.
 */
export function createReviewSendBuffer() {
  let pending: BufferedReview | null = null;

  return {
    /**
     * Karte bewerten. Die zuvor zurückgehaltene Karte ist endgültig hinter
     * uns — sie wird zum Senden zurückgegeben; die neue Bewertung bleibt an
     * ihrer Stelle liegen.
     */
    rate(review: BufferedReview): BufferedReview | null {
      const previous = pending;
      pending = review;
      return previous;
    },

    /** Zurückblättern: die zurückgehaltene Bewertung der Zielkarte verwerfen. */
    back(): void {
      pending = null;
    },

    /**
     * Was noch liegt, freigeben und leeren (Runde fertig / Ansicht verlassen)
     * — so wird es genau einmal gesendet.
     */
    flush(): BufferedReview | null {
      const current = pending;
      pending = null;
      return current;
    },

    hasPending(): boolean {
      return pending !== null;
    },
  };
}
