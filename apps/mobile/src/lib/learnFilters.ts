/**
 * Filters due cards to those belonging to the given deck IDs.
 * Used by the folder detail screen for the "Alle lernen" flow.
 */
export function filterDueCardsByDeckIds<T extends { deckId: string }>(
  cards: T[],
  deckIds: string[]
): T[] {
  const set = new Set(deckIds);
  return cards.filter((c) => set.has(c.deckId));
}
