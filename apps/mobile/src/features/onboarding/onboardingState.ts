import { create } from "zustand";

const ONBOARDING_STORAGE_KEY = "clearn_onboarding_completed";

export interface OnboardingState {
  step: number;
  totalSteps: number;
  completed: boolean;
  nextStep: () => void;
  reset: () => void;
  complete: () => void;
  /** Persist completed to storage and set state; call after creating sample deck. */
  completeAndPersist: () => Promise<void>;
  /** Load completed from storage (used by root layout for redirect). */
  loadCompletedFromStorage: () => Promise<boolean>;
}

export const useOnboardingState = create<OnboardingState>((set, get) => ({
  step: 1,
  totalSteps: 3,
  completed: false,
  nextStep: () => {
    const state = get();
    const next = Math.min(state.step + 1, state.totalSteps);
    set({ step: next });
  },
  reset: () => set({ step: 1, completed: false }),
  complete: () => set({ completed: true }),
  completeAndPersist: async () => {
    const { default: AsyncStorage } = await import("@react-native-async-storage/async-storage");
    await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    set({ completed: true });
  },
  loadCompletedFromStorage: async () => {
    const { default: AsyncStorage } = await import("@react-native-async-storage/async-storage");
    const value = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
    const completed = value === "true";
    set({ completed });
    return completed;
  },
}));
