import { create } from "zustand";

export interface LearningStats {
  retentionRate: number;
  reviewCompletionRate: number;
  streakDays: number;
}

interface StatsState {
  stats: LearningStats;
  updateStats: (stats: Partial<LearningStats>) => void;
}

export const useStatsState = create<StatsState>((set) => ({
  stats: {
    retentionRate: 0.9,
    reviewCompletionRate: 0.65,
    streakDays: 3
  },
  updateStats: (updates) =>
    set((state) => ({
      stats: {
        ...state.stats,
        ...updates
      }
    }))
}));
