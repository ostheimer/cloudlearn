import { create } from "zustand";

export type SubscriptionTier = "free" | "pro" | "lifetime";

const FREE_SCAN_LIMIT = 10;

interface PaywallState {
  tier: SubscriptionTier;
  scansUsedThisMonth: number;
  canScan: () => boolean;
  consumeScan: () => boolean;
  upgrade: (tier: SubscriptionTier) => void;
  resetUsage: () => void;
}

export const usePaywallState = create<PaywallState>((set, get) => ({
  tier: "free",
  scansUsedThisMonth: 0,
  canScan: () => {
    const state = get();
    if (state.tier === "pro" || state.tier === "lifetime") {
      return true;
    }
    return state.scansUsedThisMonth < FREE_SCAN_LIMIT;
  },
  consumeScan: () => {
    const state = get();
    if (!state.canScan()) {
      return false;
    }
    if (state.tier === "free") {
      set({ scansUsedThisMonth: state.scansUsedThisMonth + 1 });
    }
    return true;
  },
  upgrade: (tier) => set({ tier }),
  resetUsage: () => set({ scansUsedThisMonth: 0 })
}));
