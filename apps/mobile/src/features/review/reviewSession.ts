import { create } from "zustand";

export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface ReviewCard {
  id: string;
  front: string;
  back: string;
}

interface ReviewSessionState {
  cards: ReviewCard[];
  index: number;
  revealed: boolean;
  completed: boolean;
  start: (cards: ReviewCard[]) => void;
  reveal: () => void;
  rateCurrent: (rating: ReviewRating) => { cardId: string; rating: ReviewRating } | null;
}

export const useReviewSession = create<ReviewSessionState>((set, get) => ({
  cards: [],
  index: 0,
  revealed: false,
  completed: false,
  start: (cards) =>
    set({
      cards,
      index: 0,
      revealed: false,
      completed: cards.length === 0
    }),
  reveal: () => set({ revealed: true }),
  rateCurrent: (rating) => {
    const { cards, index } = get();
    const current = cards[index];
    if (!current) {
      return null;
    }

    const nextIndex = index + 1;
    set({
      index: nextIndex,
      revealed: false,
      completed: nextIndex >= cards.length
    });

    return { cardId: current.id, rating };
  }
}));
