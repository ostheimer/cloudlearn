import { create } from "zustand";

export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface ReviewCard {
  id: string;
  front: string;
  back: string;
  starred?: boolean;
}

interface ReviewSessionState {
  cards: ReviewCard[];
  index: number;
  history: number[];
  ratingHistory: ReviewRating[];
  swipedLeft: number;
  swipedRight: number;
  revealed: boolean;
  completed: boolean;
  start: (cards: ReviewCard[]) => void;
  reveal: () => void;
  canGoBack: () => boolean;
  goBack: () => boolean;
  rateCurrent: (rating: ReviewRating) => { cardId: string; rating: ReviewRating } | null;
}

export const useReviewSession = create<ReviewSessionState>((set, get) => ({
  cards: [],
  index: 0,
  history: [],
  ratingHistory: [],
  swipedLeft: 0,
  swipedRight: 0,
  revealed: false,
  completed: false,
  start: (cards) =>
    set({
      cards,
      index: 0,
      history: [],
      ratingHistory: [],
      swipedLeft: 0,
      swipedRight: 0,
      revealed: false,
      completed: cards.length === 0
    }),
  reveal: () => set({ revealed: true }),
  canGoBack: () => get().history.length > 0,
  goBack: () => {
    const { history, ratingHistory, swipedLeft, swipedRight } = get();
    const previousIndex = history[history.length - 1];
    if (previousIndex === undefined) {
      return false;
    }

    // Decrement the counter that was incremented for the last rating
    const lastRating = ratingHistory[ratingHistory.length - 1];
    const wasLeft = lastRating === "again";

    set({
      index: previousIndex,
      history: history.slice(0, -1),
      ratingHistory: ratingHistory.slice(0, -1),
      swipedLeft: wasLeft ? Math.max(0, swipedLeft - 1) : swipedLeft,
      swipedRight: !wasLeft ? Math.max(0, swipedRight - 1) : swipedRight,
      revealed: false,
      completed: false
    });
    return true;
  },
  rateCurrent: (rating) => {
    const { cards, index, history, ratingHistory, swipedLeft, swipedRight } = get();
    const current = cards[index];
    if (!current) {
      return null;
    }

    const nextIndex = index + 1;
    const isLeft = rating === "again";
    set({
      index: nextIndex,
      history: [...history, index],
      ratingHistory: [...ratingHistory, rating],
      swipedLeft: isLeft ? swipedLeft + 1 : swipedLeft,
      swipedRight: !isLeft ? swipedRight + 1 : swipedRight,
      revealed: false,
      completed: nextIndex >= cards.length
    });

    return { cardId: current.id, rating };
  }
}));

// Cards the learner didn't know this session: those whose most recent rating was
// "again" (a left swipe or the "Nochmal" button — both record "again"). Uses the
// LAST rating per card so a card re-rated after "Zurück" (goBack) counts by its
// final answer, not an earlier one. Pure, so the result screen's "X von Y
// gewusst" and "only the missed ones" button are unit-testable.
export function missedCardsFrom(
  cards: ReviewCard[],
  history: number[],
  ratingHistory: ReviewRating[],
): ReviewCard[] {
  const lastRating = new Map<number, ReviewRating>();
  history.forEach((cardIndex, k) => {
    const rating = ratingHistory[k];
    if (rating) lastRating.set(cardIndex, rating);
  });
  const missed: ReviewCard[] = [];
  lastRating.forEach((rating, cardIndex) => {
    const card = cards[cardIndex];
    if (rating === "again" && card) missed.push(card);
  });
  return missed;
}
