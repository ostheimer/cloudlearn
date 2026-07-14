// Web light/dark/system theme choice. "system" follows the OS (no attribute →
// the CSS media query decides); "light"/"dark" force it via data-theme on
// <html>, which the token rules in globals.css honour. The no-flash script in
// app/layout.tsx applies the saved value before first paint.

export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "clearn-theme";

export function getStoredTheme(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "light" || value === "dark" ? value : "system";
}

export function applyTheme(choice: ThemeChoice): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (choice === "system") {
    root.removeAttribute("data-theme");
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    root.setAttribute("data-theme", choice);
    window.localStorage.setItem(STORAGE_KEY, choice);
  }
}
