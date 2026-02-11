/**
 * Supabase-backed data access layer.
 * Replaces the in-memory store with persistent Postgres storage.
 * All functions are async and map between camelCase (code) and snake_case (DB).
 */

import { createSupabaseAdminClient } from "./supabase";
import type { Flashcard } from "./contracts";

// ─── Interfaces (same shape as inMemoryStore) ───────────────────────────────

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

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDb() {
  const client = createSupabaseAdminClient();
  if (!client) {
    throw new Error(
      "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return client;
}

// ─── Row mappers (snake_case DB → camelCase code) ───────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDeckRow(row: any): DeckRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    tags: row.tags ?? [],
    deletedAt: row.deleted_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCardRow(row: any): CardRecord {
  return {
    id: row.id,
    userId: row.user_id,
    deckId: row.deck_id,
    front: row.front,
    back: row.back,
    type: row.card_type ?? "basic",
    difficulty: row.difficulty ?? "medium",
    tags: row.tags ?? [],
    fsrsDue: row.fsrs_due,
    fsrsStability: row.fsrs_stability ?? 0,
    fsrsDifficulty: row.fsrs_difficulty ?? 0,
    fsrsState: row.fsrs_state ?? "new",
    deletedAt: row.deleted_at ?? null,
  };
}

const RATING_TO_INT: Record<string, number> = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
};
const INT_TO_RATING: Record<number, "again" | "hard" | "good" | "easy"> = {
  1: "again",
  2: "hard",
  3: "good",
  4: "easy",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapReviewRow(row: any): ReviewRecord {
  return {
    id: row.id,
    userId: row.user_id,
    cardId: row.card_id,
    rating: INT_TO_RATING[row.rating] ?? "good",
    reviewedAt: row.reviewed_at,
    reviewDurationMs: row.review_duration_ms ?? undefined,
    idempotencyKey: row.idempotency_key,
  };
}

// ─── Decks ──────────────────────────────────────────────────────────────────

export async function createDeck(
  userId: string,
  title: string,
  tags: string[] = []
): Promise<DeckRecord> {
  const db = getDb();
  const { data, error } = await db
    .from("decks")
    .insert({ user_id: userId, title, tags })
    .select()
    .single();
  if (error) throw new Error(`createDeck: ${error.message}`);
  return mapDeckRow(data);
}

export async function listDecks(userId: string): Promise<DeckRecord[]> {
  const db = getDb();
  const { data, error } = await db
    .from("decks")
    .select()
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listDecks: ${error.message}`);
  return (data ?? []).map(mapDeckRow);
}

export async function getDeck(
  deckId: string
): Promise<DeckRecord | null> {
  const db = getDb();
  const { data, error } = await db
    .from("decks")
    .select()
    .eq("id", deckId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return mapDeckRow(data);
}

export async function updateDeck(
  deckId: string,
  updates: Partial<Pick<DeckRecord, "title" | "tags">>
): Promise<DeckRecord | null> {
  const db = getDb();
  const dbUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.tags !== undefined) dbUpdates.tags = updates.tags;

  const { data, error } = await db
    .from("decks")
    .update(dbUpdates)
    .eq("id", deckId)
    .is("deleted_at", null)
    .select()
    .single();
  if (error) return null;
  return mapDeckRow(data);
}

export async function softDeleteDeck(deckId: string): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("decks")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", deckId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  return !error && !!data;
}

// ─── Cards ──────────────────────────────────────────────────────────────────

export async function createCard(
  userId: string,
  deckId: string,
  card: Flashcard
): Promise<CardRecord> {
  const db = getDb();
  const { data, error } = await db
    .from("cards")
    .insert({
      user_id: userId,
      deck_id: deckId,
      front: card.front,
      back: card.back,
      card_type: card.type,
      difficulty: card.difficulty,
      tags: card.tags ?? [],
      fsrs_due: new Date().toISOString(),
      fsrs_stability: 0,
      fsrs_difficulty: 0,
      fsrs_state: "new",
    })
    .select()
    .single();
  if (error) throw new Error(`createCard: ${error.message}`);
  return mapCardRow(data);
}

export async function updateCard(
  cardId: string,
  updates: Partial<Pick<CardRecord, "front" | "back" | "type" | "difficulty" | "tags">>
): Promise<CardRecord | null> {
  const db = getDb();
  const dbUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.front !== undefined) dbUpdates.front = updates.front;
  if (updates.back !== undefined) dbUpdates.back = updates.back;
  if (updates.type !== undefined) dbUpdates.card_type = updates.type;
  if (updates.difficulty !== undefined) dbUpdates.difficulty = updates.difficulty;
  if (updates.tags !== undefined) dbUpdates.tags = updates.tags;

  const { data, error } = await db
    .from("cards")
    .update(dbUpdates)
    .eq("id", cardId)
    .is("deleted_at", null)
    .select()
    .single();
  if (error) return null;
  return mapCardRow(data);
}

export async function softDeleteCard(cardId: string): Promise<boolean> {
  const db = getDb();
  const { data, error } = await db
    .from("cards")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", cardId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  return !error && !!data;
}

export async function listCardsForDeck(
  userId: string,
  deckId: string
): Promise<CardRecord[]> {
  const db = getDb();
  const { data, error } = await db
    .from("cards")
    .select()
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listCardsForDeck: ${error.message}`);
  return (data ?? []).map(mapCardRow);
}

export async function getCard(cardId: string): Promise<CardRecord | null> {
  const db = getDb();
  const { data, error } = await db
    .from("cards")
    .select()
    .eq("id", cardId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return mapCardRow(data);
}

export async function updateCardFsrs(
  cardId: string,
  next: Pick<CardRecord, "fsrsDue" | "fsrsStability" | "fsrsDifficulty" | "fsrsState">
): Promise<CardRecord | null> {
  const db = getDb();
  const { data, error } = await db
    .from("cards")
    .update({
      fsrs_due: next.fsrsDue,
      fsrs_stability: next.fsrsStability,
      fsrs_difficulty: next.fsrsDifficulty,
      fsrs_state: next.fsrsState,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId)
    .is("deleted_at", null)
    .select()
    .single();
  if (error) return null;
  return mapCardRow(data);
}

// ─── Reviews ────────────────────────────────────────────────────────────────

export async function createReview(
  review: Omit<ReviewRecord, "id">
): Promise<ReviewRecord> {
  const db = getDb();
  const { data, error } = await db
    .from("review_logs")
    .insert({
      user_id: review.userId,
      card_id: review.cardId,
      rating: RATING_TO_INT[review.rating] ?? 3,
      reviewed_at: review.reviewedAt,
      review_duration_ms: review.reviewDurationMs ?? null,
      idempotency_key: review.idempotencyKey,
    })
    .select()
    .single();
  if (error) throw new Error(`createReview: ${error.message}`);
  return mapReviewRow(data);
}

export async function findReviewByIdempotencyKey(
  userId: string,
  idempotencyKey: string
): Promise<ReviewRecord | null> {
  const db = getDb();
  const { data, error } = await db
    .from("review_logs")
    .select()
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error || !data) return null;
  return mapReviewRow(data);
}

// ─── Learning (Due Cards) ───────────────────────────────────────────────────

export async function listDueCards(
  userId: string,
  nowIso: string
): Promise<CardRecord[]> {
  const db = getDb();
  const { data, error } = await db
    .from("cards")
    .select()
    .eq("user_id", userId)
    .is("deleted_at", null)
    .lte("fsrs_due", nowIso)
    .order("fsrs_due", { ascending: true });
  if (error) throw new Error(`listDueCards: ${error.message}`);
  return (data ?? []).map(mapCardRow);
}

// ─── Subscription (from profiles table) ─────────────────────────────────────

export async function getSubscriptionTier(
  userId: string
): Promise<{ tier: string; expiresAt: string | null; isActive: boolean }> {
  const db = getDb();
  const { data, error } = await db
    .from("profiles")
    .select("subscription_tier, subscription_expires_at")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return { tier: "free", expiresAt: null, isActive: true };
  const expiresAt = data.subscription_expires_at ?? null;
  const isActive = !expiresAt || new Date(expiresAt) > new Date();
  return {
    tier: data.subscription_tier ?? "free",
    expiresAt,
    isActive,
  };
}

export async function updateSubscriptionTier(
  userId: string,
  tier: string,
  isActive: boolean,
  expiresAt: string | null
): Promise<void> {
  const db = getDb();
  await db
    .from("profiles")
    .update({
      subscription_tier: tier,
      subscription_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

// ─── Scan History ───────────────────────────────────────────────────────────

export async function listScanHistory(
  userId: string,
  limit = 50
): Promise<
  Array<{
    id: string;
    imageUrl: string;
    aiModel: string | null;
    cardsGenerated: number;
    createdAt: string;
  }>
> {
  const db = getDb();
  const { data, error } = await db
    .from("scans")
    .select("id, image_url, ai_model, cards_generated, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listScanHistory: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    imageUrl: row.image_url,
    aiModel: row.ai_model,
    cardsGenerated: row.cards_generated,
    createdAt: row.created_at,
  }));
}

export async function recordScan(
  userId: string,
  aiModel: string,
  cardsGenerated: number,
  imageUrl = "",
  extractedText?: string
): Promise<string> {
  const db = getDb();
  const { data, error } = await db
    .from("scans")
    .insert({
      user_id: userId,
      image_url: imageUrl,
      ai_model: aiModel,
      cards_generated: cardsGenerated,
      extracted_text: extractedText ?? null,
      status: "processed",
    })
    .select("id")
    .single();
  if (error) throw new Error(`recordScan: ${error.message}`);
  return data.id;
}
