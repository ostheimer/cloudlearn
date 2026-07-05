import type { Card, Deck } from "./api";

export interface OfflineDeckCachePayload {
  deck: Deck;
  cards: Card[];
  exportedAt?: string;
}

export function offlineDeckStorageKey(deckId: string): string {
  return `offline_deck_${deckId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOfflineCard(value: unknown): value is Card {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.userId === "string" &&
    typeof value.deckId === "string" &&
    typeof value.front === "string" &&
    typeof value.back === "string" &&
    typeof value.type === "string" &&
    typeof value.difficulty === "string" &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    typeof value.starred === "boolean" &&
    typeof value.fsrsDue === "string" &&
    typeof value.fsrsState === "string"
  );
}

export function cardsFromOfflineDeckCache(raw: string | null): Card[] | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<OfflineDeckCachePayload>;
    if (!Array.isArray(parsed.cards)) return null;
    if (!parsed.cards.every(isOfflineCard)) return null;
    return parsed.cards;
  } catch {
    return null;
  }
}
