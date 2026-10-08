/** The ordered cards of a paused round are independent of today's due filter. */
export interface ResumableSession {
  index: number;
  cardId: string;
  source: string;
  total: number;
  cardIds?: string[];
  results?: Record<string, { correct: boolean; overridden: boolean }>;
}

export function parseSessionCardIds(value: unknown, progress: Pick<ResumableSession, "index" | "cardId" | "total">): string[] | undefined {
  if (!Array.isArray(value) || value.length !== progress.total || value.length > 2000) return undefined;
  if (!value.every((id): id is string => typeof id === "string" && id.length > 0)) return undefined;
  if (new Set(value).size !== value.length || value[progress.index] !== progress.cardId) return undefined;
  return value;
}

/**
 * Return a queue with its already answered prefix intact. The session can keep
 * using its existing undo floor, result counters and LP accounting unchanged.
 * New due cards never join a saved snapshot; deleted cards simply drop out.
 * Old markers have no snapshot: anchor by card ID in the current due tail and
 * restore only outcomes that actually exist, never inventing earlier answers.
 */
export function resolveSessionResume<T extends { id: string }>(
  progress: ResumableSession | null | undefined,
  currentCards: T[],
  source: string,
  allCards: T[] = currentCards,
): { cards: T[]; index: number } | null {
  if (!progress || progress.source !== source) return null;
  const byId = new Map(allCards.map((card) => [card.id, card]));
  const snapshot = parseSessionCardIds(progress.cardIds, progress);
  let before: T[];
  let remaining: T[];
  if (source !== "due") {
    // Keep strict source/index validation, then restore an already submitted
    // current cloze answer just as for due rounds (including the final card).
    if (currentCards[progress.index]?.id !== progress.cardId) return null;
    before = currentCards.slice(0, progress.index);
    remaining = currentCards.slice(progress.index);
  } else if (snapshot) {
    before = snapshot.slice(0, progress.index).flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
    remaining = snapshot.slice(progress.index).flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
  } else {
    // With no original order, never guess the successor of a deleted anchor.
    const anchor = currentCards.findIndex((card) => card.id === progress.cardId);
    if (anchor < 0) return null;
    before = allCards.filter((card) => progress.results?.[card.id] !== undefined && card.id !== progress.cardId);
    remaining = currentCards.slice(anchor).filter((card) => !before.some((previous) => previous.id === card.id));
  }
  // Cloze may be interrupted after submitting the visible card, before Next.
  // Its stored outcome is final; resuming must not submit/award that card again.
  const answered = remaining.filter((card) => progress.results?.[card.id] !== undefined);
  const pending = remaining.filter((card) => progress.results?.[card.id] === undefined);
  const prefix = [...before, ...answered];
  const cards = [...prefix, ...pending];
  return cards.length > 0 ? { cards, index: prefix.length } : null;
}
