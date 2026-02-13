// Design tokens for clearn.ai mobile app
// Supports light and dark mode

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "react-native";

// ─── Color schemes ───────────────────────────────────────────────────────────

const lightColors = {
  // Primary
  primary: "#6366f1",
  primaryLight: "#eef2ff",
  primaryDark: "#4f46e5",

  // Neutral
  background: "#f8fafc",
  surface: "#ffffff",
  surfaceSecondary: "#f1f5f9",
  border: "#e2e8f0",
  borderLight: "#f1f5f9",

  // Text
  text: "#0f172a",
  textSecondary: "#64748b",
  textTertiary: "#94a3b8",
  textInverse: "#ffffff",

  // Semantic
  success: "#10b981",
  successLight: "#ecfdf5",
  warning: "#f59e0b",
  warningLight: "#fffbeb",
  error: "#ef4444",
  errorLight: "#fef2f2",
  info: "#3b82f6",
  infoLight: "#eff6ff",

  // Rating buttons
  ratingAgain: "#ef4444",
  ratingHard: "#f59e0b",
  ratingGood: "#10b981",
  ratingEasy: "#3b82f6",

  // Gradients / accent
  accent: "#8b5cf6",
  accentLight: "#f5f3ff",
} as const;

const darkColors = {
  // Primary
  primary: "#818cf8",
  primaryLight: "#1e1b4b",
  primaryDark: "#a5b4fc",

  // Neutral
  background: "#0f172a",
  surface: "#1e293b",
  surfaceSecondary: "#334155",
  border: "#475569",
  borderLight: "#334155",

  // Text
  text: "#f1f5f9",
  textSecondary: "#94a3b8",
  textTertiary: "#64748b",
  textInverse: "#0f172a",

  // Semantic
  success: "#34d399",
  successLight: "#064e3b",
  warning: "#fbbf24",
  warningLight: "#451a03",
  error: "#f87171",
  errorLight: "#450a0a",
  info: "#60a5fa",
  infoLight: "#1e3a5f",

  // Rating buttons
  ratingAgain: "#f87171",
  ratingHard: "#fbbf24",
  ratingGood: "#34d399",
  ratingEasy: "#60a5fa",

  // Gradients / accent
  accent: "#a78bfa",
  accentLight: "#2e1065",
} as const;

// Use string-based type so light and dark schemes are interchangeable
export type ColorScheme = { [K in keyof typeof lightColors]: string };
export type ThemeMode = "system" | "light" | "dark";

// ─── Theme store ─────────────────────────────────────────────────────────────

interface ThemeState {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (mode: Exclude<ThemeMode, "system">) => void;
  setSystem: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "system",
      toggle: () => set((s) => ({ mode: s.mode === "light" ? "dark" : "light" })),
      setMode: (mode) => set({ mode }),
      setSystem: () => set({ mode: "system" }),
    }),
    {
      name: "clearn-theme",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// ─── Hook to get current colors ──────────────────────────────────────────────

export function useResolvedThemeMode(): "light" | "dark" {
  const mode = useThemeStore((s) => s.mode);
  const systemTheme = useColorScheme();

  if (mode === "system") {
    return systemTheme === "dark" ? "dark" : "light";
  }

  return mode;
}

export function useColors(): ColorScheme {
  const mode = useResolvedThemeMode();
  return mode === "dark" ? darkColors : lightColors;
}

// ─── Static exports (for non-hook contexts) ─────────────────────────────────

export const colors = lightColors; // fallback for static imports
export const getColors = (mode: ThemeMode): ColorScheme =>
  mode === "dark" ? darkColors : lightColors;

// ─── Layout tokens (unchanged) ───────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const typography = {
  // Font sizes
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,

  // Font weights
  normal: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  extrabold: "800" as const,
} as const;

export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;
