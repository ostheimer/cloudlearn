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
  starred: boolean;
  fsrsDue: string;
  fsrsStability: number;
  fsrsDifficulty: number;
  fsrsState: "new" | "learning" | "review" | "relearning";
  fsrsReps: number;
  fsrsLapses: number;
  fsrsElapsedDays: number;
  fsrsScheduledDays: number;
  fsrsLearningSteps: number;
  fsrsLastReview: string | null;
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
    starred: row.starred ?? false,
    fsrsDue: row.fsrs_due,
    fsrsStability: row.fsrs_stability ?? 0,
    fsrsDifficulty: row.fsrs_difficulty ?? 0,
    fsrsState: row.fsrs_state ?? "new",
    fsrsReps: row.fsrs_reps ?? 0,
    fsrsLapses: row.fsrs_lapses ?? 0,
    fsrsElapsedDays: row.fsrs_elapsed_days ?? 0,
    fsrsScheduledDays: row.fsrs_scheduled_days ?? 0,
    fsrsLearningSteps: row.fsrs_learning_steps ?? 0,
    fsrsLastReview: row.fsrs_last_review ?? null,
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
  updates: Partial<Pick<CardRecord, "front" | "back" | "type" | "difficulty" | "tags" | "starred">>
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
  if (updates.starred !== undefined) dbUpdates.starred = updates.starred;

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
  next: Pick<
    CardRecord,
    | "fsrsDue"
    | "fsrsStability"
    | "fsrsDifficulty"
    | "fsrsState"
    | "fsrsReps"
    | "fsrsLapses"
    | "fsrsElapsedDays"
    | "fsrsScheduledDays"
    | "fsrsLearningSteps"
    | "fsrsLastReview"
  >
): Promise<CardRecord | null> {
  const db = getDb();
  const { data, error } = await db
    .from("cards")
    .update({
      fsrs_due: next.fsrsDue,
      fsrs_stability: next.fsrsStability,
      fsrs_difficulty: next.fsrsDifficulty,
      fsrs_state: next.fsrsState,
      fsrs_reps: next.fsrsReps,
      fsrs_lapses: next.fsrsLapses,
      fsrs_elapsed_days: next.fsrsElapsedDays,
      fsrs_scheduled_days: next.fsrsScheduledDays,
      fsrs_learning_steps: next.fsrsLearningSteps,
      fsrs_last_review: next.fsrsLastReview,
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

// ─── Streaks & Stats ────────────────────────────────────────────────────────

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastReviewDate: string | null;
  dailyGoal: number;
}

export async function getStreakInfo(userId: string): Promise<StreakInfo> {
  const db = getDb();
  const { data, error } = await db
    .from("profiles")
    .select("current_streak, longest_streak, last_review_date, daily_goal")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return { currentStreak: 0, longestStreak: 0, lastReviewDate: null, dailyGoal: 10 };
  return {
    currentStreak: data.current_streak ?? 0,
    longestStreak: data.longest_streak ?? 0,
    lastReviewDate: data.last_review_date ?? null,
    dailyGoal: data.daily_goal ?? 10,
  };
}

/**
 * Update streak after a review. Call after each review.
 * Compares last_review_date with today (user timezone = UTC for simplicity).
 */
export async function updateStreakAfterReview(userId: string): Promise<StreakInfo> {
  const db = getDb();
  const today: string = new Date().toISOString().split("T")[0] ?? "";

  const current = await getStreakInfo(userId);

  let newStreak = current.currentStreak;
  if (current.lastReviewDate === today) {
    // Already reviewed today — no change
    return current;
  } else if (current.lastReviewDate) {
    const lastDate = new Date(current.lastReviewDate);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      // Consecutive day
      newStreak = current.currentStreak + 1;
    } else {
      // Gap — reset streak
      newStreak = 1;
    }
  } else {
    // First ever review
    newStreak = 1;
  }

  const newLongest = Math.max(newStreak, current.longestStreak);

  const { error } = await db
    .from("profiles")
    .update({
      current_streak: newStreak,
      longest_streak: newLongest,
      last_review_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw new Error(`updateStreakAfterReview: ${error.message}`);

  return {
    currentStreak: newStreak,
    longestStreak: newLongest,
    lastReviewDate: today,
    dailyGoal: current.dailyGoal,
  };
}

/**
 * Get aggregated review stats for a user.
 */
export async function getReviewStats(userId: string): Promise<{
  reviewsToday: number;
  reviewsThisWeek: number;
  reviewsTotal: number;
  accuracyRate: number;
  reviewsByDay: Array<{ date: string; count: number }>;
}> {
  const db = getDb();
  const now = new Date();
  const todayStart = new Date((now.toISOString().split("T")[0] ?? "") + "T00:00:00Z").toISOString();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Reviews today
  const { count: todayCount } = await db
    .from("review_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("reviewed_at", todayStart);

  // Reviews this week
  const { count: weekCount } = await db
    .from("review_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("reviewed_at", weekStart);

  // Reviews total
  const { count: totalCount } = await db
    .from("review_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  // Accuracy (good+easy out of total)
  const { count: goodCount } = await db
    .from("review_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("rating", 3); // 3=good, 4=easy

  const total = totalCount ?? 0;
  const good = goodCount ?? 0;
  const accuracyRate = total > 0 ? good / total : 0;

  // Daily counts for last 30 days (for heatmap)
  const { data: dailyData } = await db
    .from("review_logs")
    .select("reviewed_at")
    .eq("user_id", userId)
    .gte("reviewed_at", monthStart)
    .order("reviewed_at", { ascending: true });

  const dayMap: Record<string, number> = {};
  (dailyData ?? []).forEach((r) => {
    const day = r.reviewed_at.split("T")[0] ?? "";
    dayMap[day] = (dayMap[day] ?? 0) + 1;
  });
  const reviewsByDay = Object.entries(dayMap).map(([date, count]) => ({ date, count }));

  return {
    reviewsToday: todayCount ?? 0,
    reviewsThisWeek: weekCount ?? 0,
    reviewsTotal: total,
    accuracyRate: Math.round(accuracyRate * 100) / 100,
    reviewsByDay,
  };
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
