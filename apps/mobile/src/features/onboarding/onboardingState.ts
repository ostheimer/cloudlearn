import { create } from "zustand";

const ONBOARDING_STORAGE_KEY = "clearn_onboarding_completed";

export interface OnboardingState {
  step: number;
  totalSteps: number;
  completed: boolean;
  /**
   * Die Einführung wird gerade freiwillig ein zweites Mal angesehen (#609,
   * Profil → „Einführung erneut ansehen"). Dann darf am Ende KEIN zweites
   * Beispiel-Deck entstehen, und die Weiterleitung im Wurzel-Layout darf
   * nicht sofort zurück in die Tabs schicken. Bewusst nur im Speicher:
   * Nach einem App-Neustart ist der Merker weg und niemand hängt fest.
   */
  replay: boolean;
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
  /** Einführung freiwillig erneut ansehen — beginnt bei Schritt 1. */
  startReplay: () => void;
  endReplay: () => void;
  complete: () => void;
  /** Persist completed to storage and set state; call after creating sample deck. */
  completeAndPersist: () => Promise<void>;
  /** Load completed from storage (used by root layout for redirect). */
  loadCompletedFromStorage: () => Promise<boolean>;
}

/**
 * Nur Konten ohne ein einziges Deck gelten als neu — wie im Web (Laras
 * Entscheidung 27.07.). Bestandskonten bekommen den Haken still gesetzt,
 * statt nach jeder Neuinstallation die Einführung samt zweitem
 * Beispiel-Deck durchklicken zu müssen.
 */
export function shouldShowOnboardingForDeckCount(deckCount: number): boolean {
  return deckCount === 0;
}

export const useOnboardingState = create<OnboardingState>((set, get) => ({
  step: 1,
  // 5 seit #609: Schritt 4 erklärt die Lernpunkte, bevor die ersten weg sind.
  totalSteps: 5,
  completed: false,
  replay: false,
  nextStep: () => {
    const state = get();
    const next = Math.min(state.step + 1, state.totalSteps);
    set({ step: next });
  },
  prevStep: () => {
    const state = get();
    set({ step: Math.max(state.step - 1, 1) });
  },
  reset: () => set({ step: 1, completed: false, replay: false }),
  startReplay: () => set({ step: 1, replay: true }),
  endReplay: () => set({ step: 1, replay: false }),
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
