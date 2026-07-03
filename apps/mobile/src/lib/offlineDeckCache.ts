import type { Card, Deck } from "./api";

export interface OfflineDeckCachePayload {
  deck: Deck;
  cards: Card[];
  exportedAt?: string;
}

export function offlineDeckStorageKey(deckId: string): string {
  return `offline_deck_${deckId}`;
}

export function cardsFromOfflineDeckCache(raw: string | null): Card[] | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<OfflineDeckCachePayload>;
    if (!Array.isArray(parsed.cards)) return null;
    return parsed.cards;
  } catch {
    return null;
  }
}
