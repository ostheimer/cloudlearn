import { create } from "zustand";

// Mirrors the API response from GET /api/v1/usage.
export interface UsageState {
  tier: "free" | "pro";
  lpBalance: number;
  lpEarnedToday: number;
  lpAdsToday: number;
  lpEarnCapToday: number;
  lpAdCapToday: number;
  lpCostAiScan: number;
  lpCostUrlImport: number;
  lpCostPdfImport: number;
  periodStart: string | null;
  isLoaded: boolean;

  // Optimistically deduct LP after a successful feature use
  deductLp: (amount: number) => void;

  // Overwrite from server response
  setUsage: (usage: Partial<Omit<UsageState, "isLoaded" | "deductLp" | "setUsage" | "reset">>) => void;

  reset: () => void;
}

const INITIAL_STATE: Omit<UsageState, "deductLp" | "setUsage" | "reset"> = {
  tier: "free",
  lpBalance: 10,
  lpEarnedToday: 0,
  lpAdsToday: 0,
  lpEarnCapToday: 30,
  lpAdCapToday: 20,
  lpCostAiScan: 10,
  lpCostUrlImport: 15,
  lpCostPdfImport: 20,
  periodStart: null,
  isLoaded: false,
};

export const useUsageStore = create<UsageState>((set, get) => ({
  ...INITIAL_STATE,

  deductLp: (amount: number) => {
    const s = get();
    if (s.lpBalance >= amount) {
      set({ lpBalance: Math.max(s.lpBalance - amount, 0) });
    }
  },

  setUsage: (usage) => set({ ...usage, isLoaded: true }),

  reset: () => set({ ...INITIAL_STATE, isLoaded: false }),
}));
