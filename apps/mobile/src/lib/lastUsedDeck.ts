import AsyncStorage from "@react-native-async-storage/async-storage";

// "Zuletzt genutzt" on Home: the deck the learner last OPENED on this device.
// Server-side "last studied" only sees Karteikarten reviews (practice modes
// write no review_logs by design), so opening the deck view is the honest,
// mode-independent signal.

const STORAGE_KEY = "last-used-deck";

export interface LastUsedDeck {
  id: string;
  title: string;
}

/** Parse the stored JSON; null for missing/corrupt values. */
export function parseLastUsedDeck(raw: string | null): LastUsedDeck | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { id?: unknown; title?: unknown };
    if (typeof value.id !== "string" || value.id.length === 0) return null;
    return { id: value.id, title: typeof value.title === "string" ? value.title : "" };
  } catch {
    return null;
  }
}

export async function setLastUsedDeck(deck: LastUsedDeck): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(deck));
  } catch {
    // Best-effort — losing this marker only affects a convenience row.
  }
}

export async function getLastUsedDeck(): Promise<LastUsedDeck | null> {
  try {
    return parseLastUsedDeck(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}
