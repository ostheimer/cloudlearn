// Vorlese-Tempo der Karteikarten-Autoplay (#610): stand bisher nirgends
// gespeichert, jede Sitzung fing wieder bei 3s an, egal was man zuletzt
// gewählt hatte. Global statt je Deck — es ist eine persönliche Vorliebe,
// keine Deck-Eigenschaft.
const STORAGE_KEY = "clearn:autoplay-speed";
export const AUTO_PLAY_SPEEDS: readonly number[] = [1, 3, 5, 10];
export const DEFAULT_AUTO_PLAY_SPEED = 3;

export function loadAutoPlaySpeed(): number {
  if (typeof window === "undefined") return DEFAULT_AUTO_PLAY_SPEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return AUTO_PLAY_SPEEDS.includes(parsed) ? parsed : DEFAULT_AUTO_PLAY_SPEED;
  } catch {
    return DEFAULT_AUTO_PLAY_SPEED;
  }
}

export function saveAutoPlaySpeed(seconds: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(seconds));
  } catch {
    // Best-effort — ohne Speicherung fängt die nächste Sitzung nur wieder bei 3s an.
  }
}
