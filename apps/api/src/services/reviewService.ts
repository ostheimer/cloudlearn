import { applyReview, createNewFsrsCard, reconstructFsrsCard } from "@/lib/domain";
import { logInfo } from "@/lib/observability";
import {
  RECALL_MODES,
  reviewRequestSchema,
  type ReviewMode,
  type ReviewResponse,
} from "@/lib/contracts";
import type { CardRecord } from "@/lib/db";
import {
  createReview,
  findReviewByIdempotencyKey,
  getCard,
  markFriendStreakDay,
  updateCardFsrs,
  updateStreakAfterReview,
} from "@/lib/db";

const STATE_NUM_TO_STR: Record<number, "new" | "learning" | "review" | "relearning"> = {
  0: "new",
  1: "learning",
  2: "review",
  3: "relearning",
};

function buildReviewResponse(requestId: string, card: CardRecord): ReviewResponse {
  return {
    requestId,
    cardId: card.id,
    nextDueAt: card.fsrsDue,
    stability: card.fsrsStability,
    difficulty: card.fsrsDifficulty,
    state: card.fsrsState,
  };
}

/**
 * Nur Abruf-Modi dürfen den Wiederhol-Plan bewegen (Liste in `@/lib/contracts`).
 * Würde Raten als „gewusst" gebucht, schöbe FSRS die Karte in die Zukunft,
 * obwohl der Lernende sie nicht kann: der Plan verschlechtert sich unsichtbar.
 * Das war der Kern von #210.
 */

/**
 * Darf diese Wiederholung den Plan bewegen?
 *
 * Ein FEHLER zählt immer, aus jedem Modus: Wer falsch antwortet, kann die Karte
 * sicher nicht — egal, ob er getippt oder geklickt hat. Das ist das wertvollste
 * Signal überhaupt und darf nicht verlorengehen, nur weil es aus einer Prüfung
 * stammt. Ein Treffer dagegen beweist im Rate-Modus nichts.
 *
 * „Nicht gewusst" ist hier again|hard, also rating < 3 — dieselbe Grenze, die
 * die Statistik für ihre Trefferquote zieht (`gte("rating", 3)`, db.ts). Zwei
 * Stellen mit unterschiedlichen Definitionen von „richtig" wären ein Fehler,
 * der erst auffällt, wenn die Zahlen auseinanderlaufen.
 *
 * Der Eintrag selbst wird IMMER geschrieben — Streak, Freunde-Streak und
 * Statistik hängen daran und sollen auch bei einer Prüfung zählen. Übersprungen
 * wird ausschließlich die Neuplanung der Karte.
 */
function movesTheSchedule(mode: ReviewMode, rating: "again" | "hard" | "good" | "easy"): boolean {
  if (rating === "again" || rating === "hard") return true;
  return RECALL_MODES.includes(mode);
}

// Uhren gehen auseinander; ein paar Minuten Vorlauf sind kein Betrugsversuch.
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * `reviewedAt` kommt aus dem Request-Body — das muss so bleiben, weil Lernen
 * ohne Netz den echten Zeitpunkt braucht, sonst plant FSRS falsch. Ein
 * Zeitpunkt in der ZUKUNFT ist aber nie legitim: entweder eine falsch gestellte
 * Uhr oder der Versuch, sich Lerntage auf Vorrat zu buchen.
 *
 * Geklemmt, nicht abgelehnt: Der Offline-Sync verwirft abgelehnte Operationen
 * endgültig (finalizeOperations), ein 4xx würde also echtes Lernen vernichten.
 *
 * Wie ALT ein Zeitstempel höchstens sein darf, ist bewusst noch offen — das
 * wird erst in Prod gemessen (#358), bevor eine Grenze geraten wird.
 */
function clampReviewedAt(reviewedAt: string, requestId: string, userId: string): string {
  const claimed = new Date(reviewedAt).getTime();
  const now = Date.now();
  if (!Number.isFinite(claimed) || claimed <= now + CLOCK_SKEW_TOLERANCE_MS) {
    return reviewedAt;
  }
  logInfo("review_reviewed_at_in_future", {
    requestId,
    userId,
    claimed: reviewedAt,
    aheadMs: claimed - now,
  });
  return new Date(now).toISOString();
}

export async function storeReview(
  input: unknown,
  requestId: string
): Promise<ReviewResponse> {
  const parsed = reviewRequestSchema.parse(input);
  const reviewedAt = clampReviewedAt(parsed.reviewedAt, requestId, parsed.userId);
  const existing = await findReviewByIdempotencyKey(
    parsed.userId,
    parsed.idempotencyKey
  );
  const card = await getCard(parsed.cardId, parsed.userId);

  if (!card) {
    throw new Error("Card not found");
  }

  if (existing) {
    return buildReviewResponse(requestId, card);
  }

  const reviewInput: {
    userId: string;
    cardId: string;
    rating: "again" | "hard" | "good" | "easy";
    reviewedAt: string;
    idempotencyKey: string;
    reviewDurationMs?: number;
    mode: ReviewMode;
  } = {
    userId: parsed.userId,
    cardId: parsed.cardId,
    rating: parsed.rating,
    reviewedAt,
    idempotencyKey: parsed.idempotencyKey,
    // Schickt der Client nichts, hat das Schema bereits auf "flashcard"
    // gesetzt — der Wert ist hier also immer belegt.
    mode: parsed.mode,
  };

  if (parsed.reviewDurationMs !== undefined) {
    reviewInput.reviewDurationMs = parsed.reviewDurationMs;
  }

  await createReview(reviewInput);

  // Update streak (fire-and-forget for first review of the day)
  updateStreakAfterReview(parsed.userId).catch(() => {});
  // Advance any shared friend streaks whose partner also studied today (#237)
  markFriendStreakDay(parsed.userId).catch(() => {});

  // Ab hier nur noch die Neuplanung. Alles Vorherige (Eintrag, Streak,
  // Freunde-Streak) ist bereits passiert und gilt für JEDEN Modus — eine
  // Prüfung soll den Streak halten und in der Statistik auftauchen, auch wenn
  // sie den Plan nicht anfassen darf.
  //
  // Solange kein Client einen Modus schickt, ist mode immer "flashcard" und
  // diese Bedingung damit immer wahr: der Schritt ist nachweislich wirkungslos,
  // bis Schritt 7 die Oberflächen umstellt.
  if (!movesTheSchedule(parsed.mode, parsed.rating)) {
    logInfo("review_schedule_skipped", {
      requestId,
      userId: parsed.userId,
      mode: parsed.mode,
      rating: parsed.rating,
    });
    // Antwort aus der unveränderten Karte — der Client bekommt denselben
    // Fälligkeitstermin zurück, den die Karte schon hatte.
    return buildReviewResponse(requestId, card);
  }

  // Reconstruct the FSRS card from persisted DB state (NOT a blank new card!)
  // This ensures the algorithm considers previous reviews for scheduling.
  const isNewCard =
    card.fsrsState === "new" &&
    card.fsrsReps === 0 &&
    card.fsrsStability === 0;

  const fsrsCard = isNewCard
    ? createNewFsrsCard()
    : reconstructFsrsCard({
        fsrsDue: card.fsrsDue,
        fsrsStability: card.fsrsStability,
        fsrsDifficulty: card.fsrsDifficulty,
        fsrsState: card.fsrsState,
        fsrsReps: card.fsrsReps,
        fsrsLapses: card.fsrsLapses,
        fsrsElapsedDays: card.fsrsElapsedDays,
        fsrsScheduledDays: card.fsrsScheduledDays,
        fsrsLearningSteps: card.fsrsLearningSteps,
        fsrsLastReview: card.fsrsLastReview,
      });

  // Dieselbe geklemmte Zeit wie im Eintrag — sonst plante FSRS weiter mit einem
  // Zeitpunkt, den die Datenbank gar nicht kennt.
  const next = applyReview(fsrsCard, parsed.rating, new Date(reviewedAt));

  const updatedCard = await updateCardFsrs(
    parsed.cardId,
    parsed.userId,
    {
      fsrsDue: next.card.due.toISOString(),
      fsrsStability: next.card.stability,
      fsrsDifficulty: next.card.difficulty,
      fsrsState: STATE_NUM_TO_STR[next.card.state] ?? "review",
      fsrsReps: next.card.reps,
      fsrsLapses: next.card.lapses,
      fsrsElapsedDays: next.card.elapsed_days,
      fsrsScheduledDays: next.card.scheduled_days,
      fsrsLearningSteps: next.card.learning_steps,
      fsrsLastReview: next.card.last_review?.toISOString() ?? null,
    }
  );

  if (!updatedCard) {
    throw new Error("Card update failed");
  }

  return buildReviewResponse(requestId, updatedCard);
}
