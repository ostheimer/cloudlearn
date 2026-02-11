import type { Flashcard } from "./contracts";
import { randomUUID } from "node:crypto";

export interface DeckRecord {
  id: string;
  userId: string;
  title: string;
  tags: string[];
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CardRecord extends Flashcard {
  id: string;
  userId: string;
  deckId: string;
  fsrsDue: string;
  fsrsStability: number;
  fsrsDifficulty: number;
  fsrsState: "new" | "learning" | "review" | "relearning";
  deletedAt?: string | null;
}

export interface ReviewRecord {
  id: string;
  userId: string;
  cardId: string;
  rating: "again" | "hard" | "good" | "easy";
  reviewedAt: string;
  reviewDurationMs?: number;
  idempotencyKey: string;
}

const decks = new Map<string, DeckRecord>();
const cards = new Map<string, CardRecord>();
const reviews = new Map<string, ReviewRecord>();

export function resetStore(): void {
  decks.clear();
  cards.clear();
  reviews.clear();
}

export function createDeck(userId: string, title: string, tags: string[] = []): DeckRecord {
  const now = new Date().toISOString();
  const deck: DeckRecord = {
    id: randomUUID(),
    userId,
    title,
    tags,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
  decks.set(deck.id, deck);
  return deck;
}

export function listDecks(userId: string): DeckRecord[] {
  return [...decks.values()].filter((deck) => deck.userId === userId && !deck.deletedAt);
}

export function updateDeck(deckId: string, updates: Partial<Pick<DeckRecord, "title" | "tags">>): DeckRecord | null {
  const current = decks.get(deckId);
  if (!current || current.deletedAt) {
    return null;
  }

  const next: DeckRecord = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  decks.set(deckId, next);
  return next;
}

export function softDeleteDeck(deckId: string): boolean {
  const current = decks.get(deckId);
  if (!current || current.deletedAt) {
    return false;
  }

  decks.set(deckId, { ...current, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  return true;
}

export function createCard(userId: string, deckId: string, card: Flashcard): CardRecord {
  const record: CardRecord = {
    ...card,
    id: randomUUID(),
    userId,
    deckId,
    fsrsDue: new Date().toISOString(),
    fsrsStability: 0,
    fsrsDifficulty: 0,
    fsrsState: "new",
    deletedAt: null
  };
  cards.set(record.id, record);
  return record;
}

export function updateCard(
  cardId: string,
  updates: Partial<Pick<CardRecord, "front" | "back" | "type" | "difficulty" | "tags">>
): CardRecord | null {
  const current = cards.get(cardId);
  if (!current || current.deletedAt) {
    return null;
  }

  const updated = { ...current, ...updates };
  cards.set(cardId, updated);
  return updated;
}

export function softDeleteCard(cardId: string): boolean {
  const current = cards.get(cardId);
  if (!current || current.deletedAt) {
    return false;
  }

  cards.set(cardId, { ...current, deletedAt: new Date().toISOString() });
  return true;
}

export function listCardsForDeck(userId: string, deckId: string): CardRecord[] {
  return [...cards.values()].filter(
    (card) => card.userId === userId && card.deckId === deckId && !card.deletedAt
  );
}

export function getCard(cardId: string): CardRecord | null {
  return cards.get(cardId) ?? null;
}

export function updateCardFsrs(
  cardId: string,
  next: Pick<CardRecord, "fsrsDue" | "fsrsStability" | "fsrsDifficulty" | "fsrsState">
): CardRecord | null {
  const current = cards.get(cardId);
  if (!current || current.deletedAt) {
    return null;
  }

  const updated: CardRecord = { ...current, ...next };
  cards.set(cardId, updated);
  return updated;
}

export function createReview(review: Omit<ReviewRecord, "id">): ReviewRecord {
  const record: ReviewRecord = { id: randomUUID(), ...review };
  reviews.set(record.idempotencyKey, record);
  return record;
}

export function findReviewByIdempotencyKey(idempotencyKey: string): ReviewRecord | null {
  return reviews.get(idempotencyKey) ?? null;
}

export function listDueCards(userId: string, nowIso: string): CardRecord[] {
  const now = new Date(nowIso).getTime();
  return [...cards.values()]
    .filter((card) => card.userId === userId && !card.deletedAt)
    .filter((card) => new Date(card.fsrsDue).getTime() <= now)
    .sort((a, b) => new Date(a.fsrsDue).getTime() - new Date(b.fsrsDue).getTime());
}
