import { createEmptyCard, fsrs, Rating, type Card } from "ts-fsrs";
import type { ReviewRating } from "@clearn/contracts";

const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 365
});

const ratingMap: Record<ReviewRating, Rating> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy
};

export function createNewFsrsCard(): Card {
  return createEmptyCard();
}

export function applyReview(card: Card, rating: ReviewRating, at: Date) {
  const result = scheduler.repeat(card, at);
  const mappedRating = ratingMap[rating] as Exclude<Rating, Rating.Manual>;
  return result[mappedRating];
}
