import { create } from "zustand";

interface OnboardingState {
  step: number;
  totalSteps: number;
  completed: boolean;
  nextStep: () => void;
  reset: () => void;
  complete: () => void;
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
  complete: () => set({ completed: true })
}));
