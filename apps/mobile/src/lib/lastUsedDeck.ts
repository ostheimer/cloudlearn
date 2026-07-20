import AsyncStorage from "@react-native-async-storage/async-storage";

// "Zuletzt genutzt" on Home: the deck this device last opened OR studied.
// Server-side "last studied" only sees Karteikarten reviews (practice modes
// write no review_logs by design), so the local marker stays the honest,
// mode-independent signal — but it carries a timestamp so Home can pick
// whichever signal is actually newer instead of always preferring the local
// one (an old "opened" would otherwise outrank today's real learning).

const STORAGE_KEY = "last-used-deck";

export interface LastUsedDeck {
  id: string;
  title: string;
  /** ISO timestamp of the visit; null for markers written before #413. */
  at: string | null;
}

/** Parse the stored JSON; null for missing/corrupt values. */
export function parseLastUsedDeck(raw: string | null): LastUsedDeck | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { id?: unknown; title?: unknown; at?: unknown };
    if (typeof value.id !== "string" || value.id.length === 0) return null;
    // A marker stored by an older build has no `at`. Treating it as null (not
    // as "now") lets the server's timestamped value win, which is the safer
    // default: the stale marker is exactly what this fix is about.
    const at =
      typeof value.at === "string" && !Number.isNaN(Date.parse(value.at)) ? value.at : null;
    return { id: value.id, title: typeof value.title === "string" ? value.title : "", at };
  } catch {
    return null;
  }
}

export async function setLastUsedDeck(deck: { id: string; title: string }): Promise<void> {
  try {
    const entry: LastUsedDeck = { ...deck, at: new Date().toISOString() };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
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

export interface ShownDeck {
  id: string;
  title: string;
  /** Which signal won — drives the row's label on Home. */
  source: "used" | "studied" | "edited";
}

/**
 * Which deck the Home row shows. Both candidates are real but partial: the
 * local marker sees every mode on THIS device, the server sees Karteikarten
 * reviews from EVERY device (incl. the web). Neither is authoritative, so the
 * more recent one wins. Before #413 the local marker always won, which let a
 * deck merely opened this morning outrank a deck actually learned minutes ago.
 */
export function pickShownDeck(
  lastUsed: LastUsedDeck | null,
  lastStudied: { id: string; title: string; reviewedAt?: string } | null,
  lastEdited: { id: string; title: string } | null
): ShownDeck | null {
  const used: ShownDeck | null = lastUsed
    ? { id: lastUsed.id, title: lastUsed.title, source: "used" }
    : null;
  const studied: ShownDeck | null = lastStudied
    ? { id: lastStudied.id, title: lastStudied.title, source: "studied" }
    : null;

  if (used && studied) {
    const usedAt = lastUsed?.at ? Date.parse(lastUsed.at) : NaN;
    const studiedAt = lastStudied?.reviewedAt ? Date.parse(lastStudied.reviewedAt) : NaN;
    // Both dated: whichever happened later.
    if (!Number.isNaN(usedAt) && !Number.isNaN(studiedAt)) {
      return studiedAt > usedAt ? studied : used;
    }
    // Only the server is dated — the marker comes from a pre-#413 build and
    // could be arbitrarily old, so the dated fact wins.
    if (!Number.isNaN(studiedAt)) return studied;
    // Only the marker is dated (older API): keep the pre-#413 preference.
    return used;
  }

  return (
    used ??
    studied ??
    (lastEdited ? { id: lastEdited.id, title: lastEdited.title, source: "edited" } : null)
  );
}
