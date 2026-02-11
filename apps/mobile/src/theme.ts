// Design tokens for clearn.ai mobile app
// Consistent colors, spacing, and typography across all screens

export const colors = {
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
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;
