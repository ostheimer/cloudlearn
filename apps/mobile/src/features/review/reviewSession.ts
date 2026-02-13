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
