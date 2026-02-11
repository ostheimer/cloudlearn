import { createEmptyCard, fsrs, Rating, State, type Card } from "ts-fsrs";
import type { ReviewRating } from "./contracts";

const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 365,
});

const ratingMap: Record<ReviewRating, Rating> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

const stateMap: Record<string, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

export function createNewFsrsCard(): Card {
  return createEmptyCard();
}

/**
 * Reconstruct a ts-fsrs Card from persisted DB values.
 * This is crucial — without it, every review would treat the card as brand new.
 */
export function reconstructFsrsCard(dbValues: {
  fsrsDue: string;
  fsrsStability: number;
  fsrsDifficulty: number;
  fsrsState: string;
  fsrsReps: number;
  fsrsLapses: number;
  fsrsElapsedDays: number;
  fsrsScheduledDays: number;
  fsrsLearningSteps: number;
  fsrsLastReview: string | null;
}): Card {
  const card: Card = {
    due: new Date(dbValues.fsrsDue),
    stability: dbValues.fsrsStability,
    difficulty: dbValues.fsrsDifficulty,
    state: stateMap[dbValues.fsrsState] ?? State.New,
    reps: dbValues.fsrsReps,
    lapses: dbValues.fsrsLapses,
    elapsed_days: dbValues.fsrsElapsedDays,
    scheduled_days: dbValues.fsrsScheduledDays,
    learning_steps: dbValues.fsrsLearningSteps,
    last_review: new Date(dbValues.fsrsLastReview ?? dbValues.fsrsDue),
  };
  return card;
}

export function applyReview(card: Card, rating: ReviewRating, at: Date) {
  const result = scheduler.repeat(card, at);
  const mappedRating = ratingMap[rating] as Exclude<Rating, Rating.Manual>;
  return result[mappedRating];
}
