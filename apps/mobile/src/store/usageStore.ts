import { create } from "zustand";
import type { LpBalanceResponse } from "../lib/api";

// Mirrors the API response from GET /api/v1/usage.
export interface UsageState {
  tier: "free" | "pro" | "lifetime";
  lpBalance: number;
  lpEarnedToday: number;
  lpAdsToday: number;
  lpEarnCapToday: number;
  lpAdCapToday: number;
  lpCostAiScan: number;
  lpCostUrlImport: number;
  lpCostPdfImport: number;
  periodStart: string | null;
  // Tarif-Grenzen (#411): der Scan-Tab muss sie kennen, BEVOR Lernpunkte
  // ausgegeben werden. `null` heißt „unbekannt" — und unbekannte Grenzen
  // sperren NICHTS (#603, wie im Web): Die alte Vorbelegung mit den
  // Gratis-Werten zwang Pro-Konten die 20/150-Grenzen auf, weil die Startseite
  // den Store ohne Grenzen lud und der Scan-Tab dann nie nachlud.
  maxDecks: number | null;
  maxCardsPerDeck: number | null;
  // „Kontostand einmal geladen" — sagt NICHTS darüber, ob die Grenzen dabei
  // waren. Wer die Grenzen braucht, prüft sie selbst auf null (#603).
  isLoaded: boolean;

  // Optimistically deduct LP after a successful feature use
  deductLp: (amount: number) => void;

  // Optimistically add LP after a milestone grant. Reads the freshest balance
  // itself, so a stale caller (e.g. a captured render value) cannot base the new
  // total on an outdated number.
  addLp: (amount: number) => void;

  // Overwrite from server response
  setUsage: (usage: Partial<Omit<UsageState, "isLoaded" | "deductLp" | "addLp" | "setUsage" | "reset">>) => void;

  reset: () => void;
}

const INITIAL_STATE: Omit<UsageState, "deductLp" | "addLp" | "setUsage" | "reset"> = {
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
  maxDecks: null,
  maxCardsPerDeck: null,
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

  addLp: (amount: number) => {
    if (amount <= 0) return;
    set({ lpBalance: get().lpBalance + amount });
  },

  setUsage: (usage) => set({ ...usage, isLoaded: true }),

  reset: () => set({ ...INITIAL_STATE, isLoaded: false }),
}));

/**
 * Übersetzt die /usage-Antwort in den Store — an EINER Stelle, damit kein
 * Aufrufer die Tarif-Grenzen vergisst (#603): LpBadge, der LP-Laden und die
 * Paywall kopierten die Felder einzeln ab und ließen `limits` dabei weg; der
 * Scan-Tab hielt den Store daraufhin für fertig geladen und Pro-Konten
 * behielten die Gratis-Grenzen.
 */
export function usageFromBalanceResponse(
  res: LpBalanceResponse
): Partial<Omit<UsageState, "isLoaded" | "deductLp" | "addLp" | "setUsage" | "reset">> {
  return {
    tier: res.tier,
    lpBalance: res.lpBalance,
    lpEarnedToday: res.lpEarnedToday,
    lpAdsToday: res.lpAdsToday,
    lpEarnCapToday: res.lpEarnCapToday,
    lpAdCapToday: res.lpAdCapToday,
    lpCostAiScan: res.lpCostAiScan,
    lpCostUrlImport: res.lpCostUrlImport,
    lpCostPdfImport: res.lpCostPdfImport,
    periodStart: res.periodStart,
    // Grenzen nur übernehmen, wenn der Server sie mitschickt (ältere Server
    // tun das nicht) — sonst bleibt „unbekannt" stehen und nichts sperrt.
    ...(res.limits
      ? { maxDecks: res.limits.maxDecks, maxCardsPerDeck: res.limits.maxCardsPerDeck }
      : {}),
  };
}
