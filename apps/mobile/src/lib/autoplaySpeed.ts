import AsyncStorage from "@react-native-async-storage/async-storage";

// Vorlese-Tempo der Karteikarten-Autoplay (#610): stand bisher nirgends
// gespeichert, jede Sitzung fing wieder bei 3s an, egal was man zuletzt
// gewählt hatte. Geräteweit statt je Deck — es ist eine persönliche
// Vorliebe, keine Deck-Eigenschaft.
const STORAGE_KEY = "autoplay-speed";
export const AUTO_PLAY_SPEEDS: readonly number[] = [1, 3, 5, 10];
export const DEFAULT_AUTO_PLAY_SPEED = 3;

export async function loadAutoPlaySpeed(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return AUTO_PLAY_SPEEDS.includes(parsed) ? parsed : DEFAULT_AUTO_PLAY_SPEED;
  } catch {
    return DEFAULT_AUTO_PLAY_SPEED;
  }
}

export async function saveAutoPlaySpeed(seconds: number): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(seconds));
  } catch {
    // Best-effort — ohne Speicherung fängt die nächste Sitzung nur wieder bei 3s an.
  }
}
