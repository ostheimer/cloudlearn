import { create } from "zustand";

// Mirrors the API response from GET /api/v1/usage.
// null = unlimited (paid tier), number = remaining count.
export interface UsageState {
  tier: "free" | "pro" | "lifetime";
  aiScansUsed: number;
  aiScansLimit: number | null;
  aiScansRemaining: number | null;
  urlImportsUsed: number;
  urlImportsLimit: number | null;
  urlImportsRemaining: number | null;
  periodStart: string | null;
  isLoaded: boolean;

  // Optimistically decrement after a successful scan (before server confirms)
  decrementScanRemaining: () => void;
  decrementUrlImportRemaining: () => void;

  // Overwrite from server response (called after getAiUsage() or scan response)
  setUsage: (usage: Partial<Omit<UsageState, "isLoaded" | "decrementScanRemaining" | "decrementUrlImportRemaining" | "setUsage">>) => void;

  reset: () => void;
}

const DEFAULT_FREE_SCAN_LIMIT = 5;
const DEFAULT_FREE_URL_LIMIT = 2;

export const useUsageStore = create<UsageState>((set, get) => ({
  tier: "free",
  aiScansUsed: 0,
  aiScansLimit: DEFAULT_FREE_SCAN_LIMIT,
  aiScansRemaining: DEFAULT_FREE_SCAN_LIMIT,
  urlImportsUsed: 0,
  urlImportsLimit: DEFAULT_FREE_URL_LIMIT,
  urlImportsRemaining: DEFAULT_FREE_URL_LIMIT,
  periodStart: null,
  isLoaded: false,

  decrementScanRemaining: () => {
    const s = get();
    if (s.aiScansRemaining !== null && s.aiScansRemaining > 0) {
      set({ aiScansUsed: s.aiScansUsed + 1, aiScansRemaining: s.aiScansRemaining - 1 });
    }
  },

  decrementUrlImportRemaining: () => {
    const s = get();
    if (s.urlImportsRemaining !== null && s.urlImportsRemaining > 0) {
      set({ urlImportsUsed: s.urlImportsUsed + 1, urlImportsRemaining: s.urlImportsRemaining - 1 });
    }
  },

  setUsage: (usage) => set({ ...usage, isLoaded: true }),

  reset: () => set({
    tier: "free",
    aiScansUsed: 0,
    aiScansLimit: DEFAULT_FREE_SCAN_LIMIT,
    aiScansRemaining: DEFAULT_FREE_SCAN_LIMIT,
    urlImportsUsed: 0,
    urlImportsLimit: DEFAULT_FREE_URL_LIMIT,
    urlImportsRemaining: DEFAULT_FREE_URL_LIMIT,
    periodStart: null,
    isLoaded: false,
  }),
}));
