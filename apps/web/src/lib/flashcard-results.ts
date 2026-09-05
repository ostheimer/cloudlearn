import type { StoredCardResult } from "./session-progress";

type IdentifiedCard = { id: string };

/** Only restore answers before the resume card; never count unknown/future cards. */
export function resultsBefore(
  cards: IdentifiedCard[],
  startAt: number,
  stored: Record<string, StoredCardResult> | undefined,
): Record<string, StoredCardResult> {
  const restored: Record<string, StoredCardResult> = {};
  for (const card of cards.slice(0, Math.max(0, startAt))) {
    const result = stored?.[card.id];
    if (result) restored[card.id] = result;
  }
  return restored;
}

/** Merge this sitting's reversible history with the already persisted answers. */
export function flashcardResults(
  cards: IdentifiedCard[],
  index: number,
  prior: Record<string, StoredCardResult>,
  history: { index: number; rating: string }[],
): Record<string, StoredCardResult> {
  const results = { ...prior };
  for (const entry of history) {
    const card = cards[entry.index];
    if (!card || entry.index >= index) continue;
    results[card.id] = { correct: entry.rating === "good" || entry.rating === "easy", overridden: false };
  }
  return results;
}
