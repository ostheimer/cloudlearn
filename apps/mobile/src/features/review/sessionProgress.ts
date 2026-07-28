import AsyncStorage from "@react-native-async-storage/async-storage";

// Where a Karteikarten session for one deck was interrupted, stored on this
// device. Leaving mid-session used to drop the position: the next start began
// at card 1 again. Ratings survived (they are flushed on blur), so the learner
// re-rated cards already answered, which writes a second review and skews their
// scheduling — the deck mode studies every card, not just the due ones.
//
// Deliberately not expiring. A 138-card deck is worked through over several
// days, and a position that silently vanished overnight would recreate the
// original problem. Instead the entry is cleared when the session completes,
// and every resume is offered rather than applied, so a stale position can
// always be declined.

const STORAGE_PREFIX = "review-progress:";

/**
 * Study modes that keep a resumable position. Both run over the whole deck in a
 * stable order, so an index means the same thing next time.
 *
 * Quiz (10 questions) and Zuordnen (6 pairs) are short enough that restarting
 * costs less than the extra tap. Test is left out on purpose: its questions are
 * re-drawn on every start (which card becomes multiple-choice, in what order the
 * options sit), so a position alone would resume a quiz that no longer exists.
 */
export type ProgressMode = "flashcards" | "cloze";

/** Outcome of one already-answered card, keyed by card id in `results`. */
export interface StoredCardResult {
  correct: boolean;
  overridden: boolean;
}

export interface SessionProgress {
  /** Zero-based index of the card the learner stopped on. */
  index: number;
  /** Id of the card at `index` when it was saved — see isProgressUsable. */
  cardId: string;
  /** Card source the session ran with ("all" | "starred" | "wobbly"). */
  source: string;
  /** Whether the session asked back-to-front. */
  reverse: boolean;
  /** Card count at save time, for the "Karte 9 von 40" label. */
  total: number;
  /**
   * Outcomes of the cards answered before the interruption, keyed by card id.
   * Lets the summary after a resume count the whole round ("11 von 12") and
   * puts old wrong cards back into the retry pile. Optional: bookmarks written
   * before this field existed resume fine, the summary then counts only the
   * current sitting.
   */
  results?: Record<string, StoredCardResult>;
}

/** Keep only entries shaped like a result; a corrupt map must not kill the bookmark. */
function parseStoredResults(value: unknown): Record<string, StoredCardResult> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const entries: Record<string, StoredCardResult> = {};
  for (const [cardId, result] of Object.entries(value)) {
    if (typeof result !== "object" || result === null) continue;
    const { correct, overridden } = result as Record<string, unknown>;
    if (typeof correct !== "boolean" || typeof overridden !== "boolean") continue;
    entries[cardId] = { correct, overridden };
  }
  return Object.keys(entries).length > 0 ? entries : undefined;
}

// The mode belongs in the key: one deck can have a Karteikarten session and a
// Lückentext session interrupted at the same time, and they are different piles
// (Lückentext only studies typeable cards). A shared key would let whichever
// mode was used last silently overwrite the other one's position.
function storageKey(deckId: string, mode: ProgressMode): string {
  return `${STORAGE_PREFIX}${mode}:${deckId}`;
}

/** Parse stored JSON; null for missing, corrupt or implausible values. */
export function parseSessionProgress(raw: string | null): SessionProgress | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const { index, cardId, source, reverse, total } = value;
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0) return null;
    if (typeof cardId !== "string" || cardId.length === 0) return null;
    if (typeof source !== "string" || source.length === 0) return null;
    if (typeof total !== "number" || !Number.isInteger(total) || total <= 0) return null;
    // An index at or past the end is a finished session, not a resumable one.
    if (index >= total) return null;
    const results = parseStoredResults(value.results);
    return { index, cardId, source, reverse: reverse === true, total, ...(results ? { results } : {}) };
  } catch {
    return null;
  }
}

/**
 * True when stored progress still points at the same card in the current pile.
 *
 * Cards get added, deleted or unstarred between sessions, which shifts every
 * later position. Resuming on the index alone would then drop the learner at an
 * arbitrary card with no way to notice. Comparing the stored card id against
 * the card now at that index is a cheap, exact check: it either matches or the
 * pile changed, in which case starting over is the honest outcome.
 *
 * The source must match too — "Nur markierte" and "Alle" are different piles,
 * so an index from one says nothing about the other.
 */
export function isProgressUsable(
  progress: SessionProgress | null,
  cardIds: string[],
  source: string
): boolean {
  if (!progress) return false;
  if (progress.source !== source) return false;
  if (progress.index >= cardIds.length) return false;
  return cardIds[progress.index] === progress.cardId;
}

export async function saveSessionProgress(
  deckId: string,
  mode: ProgressMode,
  progress: SessionProgress
): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(deckId, mode), JSON.stringify(progress));
  } catch {
    // Best-effort — losing the marker costs a resume offer, never a rating.
  }
}

export async function loadSessionProgress(
  deckId: string,
  mode: ProgressMode
): Promise<SessionProgress | null> {
  try {
    return parseSessionProgress(await AsyncStorage.getItem(storageKey(deckId, mode)));
  } catch {
    return null;
  }
}

export async function clearSessionProgress(
  deckId: string,
  mode: ProgressMode
): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(deckId, mode));
  } catch {
    // Best-effort — a leftover entry is offered, not applied, so it can be declined.
  }
}
