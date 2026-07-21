/**
 * Supabase-backed data access layer.
 * Replaces the in-memory store with persistent Postgres storage.
 * All functions are async and map between camelCase (code) and snake_case (DB).
 */

import { createSupabaseAdminClient } from "./supabase";
import { daysBetween, startOfLocalDayIso, startOfTodayLocalIso, todayLocal } from "./localDay";
import { STREAK_REPAIR } from "./featureGates";
import type { Flashcard, SubscriptionTier } from "./contracts";

// ─── Interfaces (same shape as inMemoryStore) ───────────────────────────────

export interface DeckRecord {
  id: string;
  userId: string;
  title: string;
  tags: string[];
  /** Cards you can study normally. Excludes Bild-Occlusion (own mode). */
  cardCount?: number;
  /**
   * Bild-Occlusion cards, counted separately so a deck can show "20 Karten ·
   * 10 Bilder". Without it, a deck holding only image cards would report
   * "0 Karten" and look broken — the cards are there, just in another mode.
   */
  imageCardCount?: number;
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
  /** Aus welchem Lernmodus die Wiederholung stammt (Default in der DB:
   *  'flashcard'). Entscheidet in Schritt 5/6, wer sie mitzählt. */
  mode?: "flashcard" | "practice" | "cloze" | "occlusion" | "quiz" | "match" | "test";
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
  const cardCount = Array.isArray(row.cards) ? (row.cards[0]?.count ?? undefined) : undefined;
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    tags: row.tags ?? [],
    ...(cardCount !== undefined ? { cardCount: Number(cardCount) } : {}),
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
    sourceImageUrl: row.source_image_url ?? undefined,
    extraData: (row.extra_data ?? undefined) as Record<string, unknown> | undefined,
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
    .select("*, cards(count)")
    // Bild-Occlusion-Karten sind ein eigener Modus und zählen nicht als „Karten"
    // des Decks (der eingebettete Zähler filtert sie deshalb aus). Decks, die nur
    // Bild-Karten haben, erscheinen weiterhin mit Zähler 0.
    .neq("cards.card_type", "occlusion")
    // Karten werden per softDeleteCard nur mit deleted_at markiert; ohne diesen
    // Filter zählt der Embed sie mit und das Deck meldet dauerhaft zu viele Karten.
    .is("cards.deleted_at", null)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listDecks: ${error.message}`);

  // Bild-Karten separat zählen. Sie im eingebetteten Zähler mitzuzählen ginge
  // nicht: PostgREST kann dieselbe eingebettete Beziehung nicht zweimal
  // unterschiedlich filtern. Deshalb EINE zusätzliche schlanke Abfrage (nicht
  // pro Deck — kein N+1), die anschließend zugeordnet wird.
  const { data: imageRows, error: imageError } = await db
    .from("cards")
    .select("deck_id")
    .eq("user_id", userId)
    .eq("card_type", "occlusion")
    .is("deleted_at", null);
  if (imageError) throw new Error(`listDecks (Bild-Karten): ${imageError.message}`);

  const imagesByDeck = new Map<string, number>();
  for (const row of (imageRows ?? []) as Array<{ deck_id: string | null }>) {
    if (!row.deck_id) continue;
    imagesByDeck.set(row.deck_id, (imagesByDeck.get(row.deck_id) ?? 0) + 1);
  }

  return (data ?? []).map((row) => {
    const deck = mapDeckRow(row);
    return { ...deck, imageCardCount: imagesByDeck.get(deck.id) ?? 0 };
  });
}

export async function getDeck(
  deckId: string,
  userId: string
): Promise<DeckRecord | null> {
  const db = getDb();
  const { data, error } = await db
    .from("decks")
    .select()
    .eq("id", deckId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return mapDeckRow(data);
}

export async function updateDeck(
  deckId: string,
  userId: string,
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
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select()
    .maybeSingle();
  if (error || !data) return null;
  return mapDeckRow(data);
}

export async function softDeleteDeck(deckId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("decks")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", deckId)
    .eq("user_id", userId)
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
      source_image_url: card.sourceImageUrl ?? null,
      extra_data: card.extraData ?? null,
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

/**
 * Batch variant of `createCard` (#411). Imports write up to `maxCardsPerDeck`
 * cards at once; doing that one INSERT per card is one round trip per card and
 * leaves a half-filled deck behind when the function times out mid-loop. One
 * statement also means the plan limit is crossed at exactly one point in time,
 * which is what the capacity guard in `importCapacity.ts` reconciles against.
 * Returns the inserted rows in insert order.
 */
export async function insertCards(
  userId: string,
  deckId: string,
  cards: Flashcard[]
): Promise<CardRecord[]> {
  if (cards.length === 0) return [];
  const db = getDb();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("cards")
    .insert(
      cards.map((card) => ({
        user_id: userId,
        deck_id: deckId,
        front: card.front,
        back: card.back,
        card_type: card.type,
        source_image_url: card.sourceImageUrl ?? null,
        extra_data: card.extraData ?? null,
        difficulty: card.difficulty,
        tags: card.tags ?? [],
        fsrs_due: now,
        fsrs_stability: 0,
        fsrs_difficulty: 0,
        fsrs_state: "new",
      }))
    )
    .select();
  if (error) throw new Error(`insertCards: ${error.message}`);
  return (data ?? []).map(mapCardRow);
}

export async function updateCard(
  cardId: string,
  userId: string,
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
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select()
    .maybeSingle();
  if (error || !data) return null;
  return mapCardRow(data);
}

export async function softDeleteCard(cardId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const { data, error } = await db
    .from("cards")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", cardId)
    .eq("user_id", userId)
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

export async function getCard(
  cardId: string,
  userId: string
): Promise<CardRecord | null> {
  const db = getDb();
  const { data, error } = await db
    .from("cards")
    .select()
    .eq("id", cardId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return mapCardRow(data);
}

export async function updateCardFsrs(
  cardId: string,
  userId: string,
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
    .eq("user_id", userId)
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
      // Fehlt der Modus, greift der Spalten-Default 'flashcard' — so bleiben
      // alte App-Builds (kein OTA) korrekt abgebildet.
      ...(review.mode ? { mode: review.mode } : {}),
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
    // "Due" means "due for a flashcard round" — that is what this list feeds
    // (/learn/due) and what the due counts on the home screen and the deck
    // badges promise. Occlusion cards are learned only in the Bild-Abdecken
    // mode (their front is a placeholder, unanswerable without the image), so
    // counting them here would show a number the learner cannot act on.
    .neq("card_type", "occlusion")
    .lte("fsrs_due", nowIso)
    .order("fsrs_due", { ascending: true });
  if (error) throw new Error(`listDueCards: ${error.message}`);
  return (data ?? []).map(mapCardRow);
}

export interface CardSearchResult {
  cardId: string;
  deckId: string;
  deckTitle: string;
  front: string;
  back: string;
}

/**
 * Case-insensitive search across the user's own card fronts/backs (the
 * Bibliothek card search). Characters with meaning in PostgREST or-filters
 * and LIKE patterns are stripped so user input cannot alter the query.
 */
export async function searchCardsForUser(
  userId: string,
  query: string,
  limit = 20
): Promise<CardSearchResult[]> {
  const term = query.replace(/[%_,()\\]/g, " ").trim();
  if (term.length < 2) return [];

  const db = getDb();
  const pattern = `%${term}%`;
  const { data, error } = await db
    .from("cards")
    .select("id, deck_id, front, back, decks(title)")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .or(`front.ilike.${pattern},back.ilike.${pattern}`)
    .limit(limit);
  if (error) throw new Error(`searchCardsForUser: ${error.message}`);

  return (data ?? []).map((row) => {
    const deck = row.decks as { title?: string } | { title?: string }[] | null;
    const deckTitle = Array.isArray(deck) ? deck[0]?.title : deck?.title;
    return {
      cardId: row.id as string,
      deckId: row.deck_id as string,
      deckTitle: deckTitle ?? "",
      front: (row.front as string) ?? "",
      back: (row.back as string) ?? "",
    };
  });
}

// ─── Streaks & Stats ────────────────────────────────────────────────────────

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastReviewDate: string | null;
  dailyGoal: number;
  streakFreezes: number;
  // Streak repair (#237 follow-up): a lost streak is repairable for a short window.
  repairAvailable: boolean;
  repairBrokenStreak: number;
  repairCost: number;
}

export async function getStreakInfo(userId: string): Promise<StreakInfo> {
  const db = getDb();
  const { data, error } = await db
    .from("profiles")
    .select("current_streak, longest_streak, last_review_date, daily_goal, streak_freezes, broken_streak, broken_on")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) {
    return {
      currentStreak: 0, longestStreak: 0, lastReviewDate: null, dailyGoal: 30,
      streakFreezes: 0, repairAvailable: false, repairBrokenStreak: 0, repairCost: STREAK_REPAIR.costLp,
    };
  }
  const brokenStreak = data.broken_streak ?? 0;
  const brokenOn = data.broken_on ?? null;
  // Repairable only for a real loss (>= 2) and only within the local-day window.
  const withinWindow =
    brokenOn != null && daysBetween(brokenOn, todayLocal()) >= 0 &&
    daysBetween(brokenOn, todayLocal()) <= STREAK_REPAIR.windowDays;
  return {
    currentStreak: data.current_streak ?? 0,
    longestStreak: data.longest_streak ?? 0,
    lastReviewDate: data.last_review_date ?? null,
    dailyGoal: data.daily_goal ?? 30,
    streakFreezes: data.streak_freezes ?? 0,
    repairAvailable: brokenStreak >= 2 && withinWindow,
    repairBrokenStreak: brokenStreak,
    repairCost: STREAK_REPAIR.costLp,
  };
}

/**
 * Set the user's daily learning goal (cards/day).
 *
 * The goal is clamped to a sane integer range [1, 500] so a malformed or
 * hostile client can't store a nonsense value. Identity is the caller's job:
 * the route passes the authenticated userId, never a body-supplied one. Returns
 * the value actually stored so the client can reflect the clamp.
 */
export async function updateDailyGoal(userId: string, goal: number): Promise<number> {
  const clamped = Math.min(500, Math.max(1, Math.round(goal)));
  const db = getDb();
  const { error } = await db
    .from("profiles")
    .update({ daily_goal: clamped, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw new Error(`updateDailyGoal: ${error.message}`);
  return clamped;
}

/**
 * Update streak after a review. Call after each review.
 *
 * The whole decision (already reviewed today? consecutive day? one-day gap a
 * freeze can cover?) runs atomically in Postgres under a row lock — see
 * 20260713140000_streak_freeze.sql. The previous TS read-modify-write could
 * lose updates under concurrent reviews (#211 follow-up). Day boundaries are
 * the user's local day (#211).
 */
export interface StreakUpdateResult {
  currentStreak: number;
  longestStreak: number;
  lastReviewDate: string | null;
  dailyGoal: number;
  streakFreezes: number;
  freezeUsed: boolean;
}

export async function updateStreakAfterReview(
  userId: string
): Promise<StreakUpdateResult> {
  const db = getDb();
  const { data, error } = await db.rpc("update_streak_after_review", {
    p_user: userId,
    p_today: todayLocal(),
  });

  if (error) throw new Error(`updateStreakAfterReview: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    // Profile row missing — same neutral fallback getStreakInfo uses.
    return { currentStreak: 0, longestStreak: 0, lastReviewDate: null, dailyGoal: 30, streakFreezes: 0, freezeUsed: false };
  }
  return {
    currentStreak: row.current_streak ?? 0,
    longestStreak: row.longest_streak ?? 0,
    lastReviewDate: row.last_review_date ?? null,
    dailyGoal: row.daily_goal ?? 30,
    streakFreezes: row.streak_freezes ?? 0,
    freezeUsed: row.freeze_used ?? false,
  };
}

/**
 * Record that the user studied today and advance any active friend streaks
 * whose other member also studied today (#237 follow-up). Fire-and-forget from
 * the review flow; all pair logic + the freeze-save run atomically in SQL.
 */
export async function markFriendStreakDay(userId: string): Promise<void> {
  const db = getDb();
  const { error } = await db.rpc("mark_friend_streak_day", {
    p_user: userId,
    p_today: todayLocal(),
  });
  if (error) throw new Error(`markFriendStreakDay: ${error.message}`);
}

/** PostgREST hands back at most this many rows per request and says nothing
 *  about the rest — no error, no marker. See selectAllRows. */
const POSTGREST_PAGE = 1000;

/**
 * Every row a query matches, not just PostgREST's first page.
 *
 * A plain `.select()` that matches more rows than the cap returns the cap's
 * worth and stays silent about it. Code that then counts or buckets those rows
 * is wrong without ever failing — the worse the truncation, the more confident
 * the wrong answer. It bites hardest where rows pile up fastest: a learner
 * doing ~180 cards an hour passes 1000 in a month after roughly six sessions,
 * and since these queries sort oldest-first, what gets cut is the NEWEST days.
 *
 * So: fetch pages until one comes back short. That termination rule doesn't
 * depend on knowing the cap — a smaller cap just means more, shorter pages.
 *
 * Only for row fetches. To count or aggregate, ask the database
 * (`count: "exact"`) — no rows cross the wire, so no cap applies.
 */
async function selectAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
  context: string
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += POSTGREST_PAGE) {
    const { data, error } = await page(offset, offset + POSTGREST_PAGE - 1);
    if (error) throw new Error(`${context}: ${error.message}`);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < POSTGREST_PAGE) return rows;
  }
}

/**
 * Days of a month (YYYY-MM) the user learned on, plus the days a streak
 * freeze covered — the data behind the streak calendar (#237). Learned days
 * come from review_logs grouped into the user's local day, so a review at
 * 00:30 Berlin time counts to the new day even though its UTC timestamp is
 * still on the old one.
 */
export interface StreakCalendarData {
  month: string;
  learnedDays: string[];
  frozenDays: string[];
}

export async function getStreakCalendar(userId: string, month: string): Promise<StreakCalendarData> {
  const db = getDb();
  const [y, m] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const nextMonthStart =
    (m ?? 1) === 12 ? `${(y ?? 0) + 1}-01-01` : `${y}-${String((m ?? 1) + 1).padStart(2, "0")}-01`;
  const fromIso = startOfLocalDayIso(monthStart);
  const toIso = startOfLocalDayIso(nextMonthStart);

  // A heavy month exceeds one page; distinct days are what we keep, not rows.
  const learnedRows = await selectAllRows<{ reviewed_at: string }>(
    (from, to) =>
      db
        .from("review_logs")
        .select("reviewed_at")
        .eq("user_id", userId)
        .gte("reviewed_at", fromIso)
        .lt("reviewed_at", toIso)
        .order("reviewed_at", { ascending: true })
        .range(from, to),
    "getStreakCalendar"
  );
  const learned = new Set<string>();
  for (const row of learnedRows) learned.add(todayLocal(new Date(row.reviewed_at)));

  const { data: freezes, error: freezeError } = await db
    .from("streak_freeze_uses")
    .select("used_on")
    .eq("user_id", userId)
    .gte("used_on", monthStart)
    .lt("used_on", nextMonthStart);
  if (freezeError) throw new Error(`getStreakCalendar: ${freezeError.message}`);

  return {
    month,
    learnedDays: [...learned].sort(),
    frozenDays: (freezes ?? []).map((r) => r.used_on as string).sort(),
  };
}

/**
 * Get aggregated review stats for a user.
 *
 * `days` selects the by-day window (7 or 30 — the route whitelists it).
 * `reviewsByDay` and `durationMsByDay` are zero-filled to exactly `days`
 * contiguous entries (oldest first, ending today) so clients can render a
 * uniform time axis. `accuracyByDay` keeps only days with reviews, because a
 * synthetic 0 % on a review-free day would distort the accuracy trend.
 */
export async function getReviewStats(
  userId: string,
  // Default 30 = the historic pre-`days`-param window (backward compatibility
  // for callers that don't pass it; the route always passes explicitly).
  days: 7 | 30 = 30
): Promise<{
  reviewsToday: number;
  reviewsThisWeek: number;
  reviewsTotal: number;
  /** Answers inside the chosen window — the denominator behind `accuracyRate`.
   *  Clients need it to tell "no answers in this window" (show a dash) from
   *  "answered, all wrong" (show 0%). `reviewsTotal` can't: it counts forever. */
  reviewsInWindow: number;
  /** Share of good+easy answers **within the chosen 7/30-day window**, not
   *  all-time — see the counts below for why. */
  accuracyRate: number;
  reviewsByDay: Array<{ date: string; count: number }>;
  accuracyByDay: Array<{ date: string; accuracy: number; count: number }>;
  durationMsByDay: Array<{ date: string; durationMs: number }>;
}> {
  const db = getDb();
  const now = new Date();
  // "Today" follows the user's local day, not UTC (#211).
  const todayStart = startOfTodayLocalIso(now);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  // Defense in depth: even if a caller bypasses the route whitelist, only the
  // two supported windows are ever queried.
  const windowDays = days === 30 ? 30 : 7;

  // By-day buckets use the UTC calendar date of `reviewed_at` (unchanged
  // behavior). Scaffold the last `windowDays` dates so every day appears
  // exactly once, including days without reviews.
  const dayKeys: string[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const key =
      new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split("T")[0] ?? "";
    dayKeys.push(key);
  }
  const windowStart = `${dayKeys[0]}T00:00:00.000Z`;

  // Reviews today — SPEIST DEN TAGESZIEL-BALKEN (reviewsToday / dailyGoal auf
  // Home, App und Web). Prüfungen zählen hier bewusst NICHT mit: „Beim Test
  // sollte man keine Lernpunkte bekommen oder etwas bei Tagesziel, da man ja im
  // Prinzip nicht gelernt hat."
  //
  // Nur DIESE Zählung filtert. Die drei darunter (Woche, gesamt, Trefferquote)
  // sind Statistik und sollen Prüfungen mitzählen — dort gilt „ein Topf".
  // Zählt Prüfungen MIT — Laras Entscheidung vom 17.07.: „alles was ich
  // gemacht habe soll zählen, auch Prüfungen."
  //
  // Das kehrt ihre frühere Regel um („keine Lernpunkte oder etwas bei
  // Tagesziel, da man ja im Prinzip nicht gelernt hat"), die genau hier saß.
  // Grund für die Kehrtwende: Diese Zahl speist den Tagesziel-Balken, während
  // das Balkendiagramm „Karten pro Tag" direkt daneben alles zählte — zwei
  // Zahlen, beide „Karten", beide „heute", verschieden.
  //
  // Ungefährlich, weil am Erreichen des Tagesziels nichts mehr hängt: die
  // LP-Prämie dafür wurde entfernt, und der Streak folgt jeder einzelnen
  // Antwort, nicht dem Ziel. Was Prüfungen weiterhin NICHT tun: Lernpunkte
  // geben (earn_session_lp überspringt sie) und den Lernplan bewegen
  // (reviewService, außer bei Fehlern).
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

  // Accuracy (good+easy) — over the SAME window as the by-day data below.
  // The three counts above are all-time on purpose and say so in their names
  // ("total", "this week"); accuracy doesn't. It is shown as a bare
  // "Genauigkeit" beside the 7/30 switch, so an all-time value would sit
  // there unmoved when the window changes — and unmoved as the user improves,
  // since a long history drowns out any recent week.
  //
  // Counted by the database (`count: "exact"`) instead of summed from
  // `dailyData`: that row fetch is subject to PostgREST's max-rows cap, so
  // summing it would quietly go wrong exactly for the heaviest users.
  const { count: windowTotalCount } = await db
    .from("review_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("reviewed_at", windowStart);

  const { count: windowGoodCount } = await db
    .from("review_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("reviewed_at", windowStart)
    .gte("rating", 3); // 3=good, 4=easy

  const total = totalCount ?? 0;
  const windowTotal = windowTotalCount ?? 0;
  const windowGood = windowGoodCount ?? 0;
  const accuracyRate = windowTotal > 0 ? windowGood / windowTotal : 0;

  // Daily counts + learn time for the requested window (bar chart, trend,
  // per-day detail). `review_duration_ms` is nullable — treat null as 0.
  // Paged: sorted oldest-first, a single page would drop the newest days of a
  // busy month — the bar chart would show 0 cards for days that were studied.
  const dailyData = await selectAllRows<{
    reviewed_at: string;
    rating: number | null;
    review_duration_ms: number | null;
  }>(
    (from, to) =>
      db
        .from("review_logs")
        .select("reviewed_at, rating, review_duration_ms")
        .eq("user_id", userId)
        .gte("reviewed_at", windowStart)
        .order("reviewed_at", { ascending: true })
        .range(from, to),
    "getReviewStats"
  );

  const dayStats: Record<string, { count: number; good: number; durationMs: number }> = {};
  for (const key of dayKeys) {
    dayStats[key] = { count: 0, good: 0, durationMs: 0 };
  }
  dailyData.forEach((r) => {
    const day = r.reviewed_at.split("T")[0] ?? "";
    const bucket = dayStats[day];
    if (!bucket) return; // outside the scaffolded window (defensive)
    bucket.count += 1;
    if ((r.rating ?? 0) >= 3) bucket.good += 1;
    bucket.durationMs += r.review_duration_ms ?? 0;
  });
  const reviewsByDay = dayKeys.map((date) => ({
    date,
    count: dayStats[date]?.count ?? 0,
  }));
  const durationMsByDay = dayKeys.map((date) => ({
    date,
    durationMs: dayStats[date]?.durationMs ?? 0,
  }));
  const accuracyByDay = dayKeys
    .filter((date) => (dayStats[date]?.count ?? 0) > 0)
    .map((date) => {
      const s = dayStats[date] ?? { count: 0, good: 0, durationMs: 0 };
      return {
        date,
        count: s.count,
        accuracy: s.count > 0 ? Math.round((s.good / s.count) * 100) / 100 : 0,
      };
    });

  return {
    reviewsToday: todayCount ?? 0,
    reviewsThisWeek: weekCount ?? 0,
    reviewsTotal: total,
    reviewsInWindow: windowTotal,
    accuracyRate: Math.round(accuracyRate * 100) / 100,
    reviewsByDay,
    accuracyByDay,
    durationMsByDay,
  };
}

/**
 * The deck the user's most recent review belongs to ("Zuletzt gelernt" on
 * Home). Follows review_logs → card → deck; null when the user has never
 * reviewed or the deck has since been deleted (cascade removes the logs).
 *
 * `reviewedAt` ships with it so clients can compare this against their own
 * local "last opened" marker and show whichever happened later (#415) —
 * without it, a stale on-device marker outranks learning done elsewhere.
 */
export async function getLastStudiedDeck(
  userId: string
): Promise<{ id: string; title: string; reviewedAt: string } | null> {
  const db = getDb();

  const { data: lastLog } = await db
    .from("review_logs")
    .select("card_id, reviewed_at")
    .eq("user_id", userId)
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lastLog?.card_id) return null;

  const { data: card } = await db
    .from("cards")
    .select("deck_id")
    .eq("id", lastLog.card_id)
    .maybeSingle();
  if (!card?.deck_id) return null;

  const { data: deck } = await db
    .from("decks")
    .select("id, title")
    .eq("id", card.deck_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!deck?.id) return null;

  return {
    id: deck.id,
    title: deck.title ?? "",
    reviewedAt: lastLog.reviewed_at as string,
  };
}

// ─── Subscription (from profiles table) ─────────────────────────────────────

export async function getSubscriptionTier(
  userId: string
): Promise<{ tier: SubscriptionTier; expiresAt: string | null; isActive: boolean }> {
  const db = getDb();
  const { data, error } = await db
    .from("profiles")
    .select("subscription_tier, subscription_expires_at")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return { tier: "free", expiresAt: null, isActive: true };
  const expiresAt = data.subscription_expires_at ?? null;
  const isActive = !expiresAt || new Date(expiresAt) > new Date();
  const tier: SubscriptionTier =
    data.subscription_tier === "pro" || data.subscription_tier === "lifetime"
      ? data.subscription_tier
      : "free";
  return {
    tier,
    expiresAt,
    isActive,
  };
}

export async function updateSubscriptionTier(
  userId: string,
  tier: SubscriptionTier,
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

// ─── Courses ─────────────────────────────────────────────────────────────────

export interface CourseRecord {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCourseRow(row: any): CourseRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description ?? null,
    color: row.color ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createCourse(
  userId: string,
  title: string,
  description?: string,
  color?: string
): Promise<CourseRecord> {
  const db = getDb();
  const { data, error } = await db
    .from("courses")
    .insert({ user_id: userId, title, description: description ?? null, color: color ?? null })
    .select()
    .single();
  if (error) throw new Error(`createCourse: ${error.message}`);
  return mapCourseRow(data);
}

export async function listCourses(userId: string): Promise<CourseRecord[]> {
  const db = getDb();
  const { data, error } = await db
    .from("courses")
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listCourses: ${error.message}`);
  return (data ?? []).map(mapCourseRow);
}

// All course accessors are scoped to the owning user_id. The admin Supabase
// client bypasses RLS, so ownership must be enforced here in code — otherwise a
// user could read/modify/delete another user's course by guessing its id (IDOR).
export async function getCourse(courseId: string, userId: string): Promise<CourseRecord | null> {
  const db = getDb();
  const { data, error } = await db
    .from("courses")
    .select()
    .eq("id", courseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return mapCourseRow(data);
}

export async function updateCourse(
  courseId: string,
  userId: string,
  updates: Partial<Pick<CourseRecord, "title" | "description" | "color">>
): Promise<CourseRecord | null> {
  const db = getDb();
  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  const { data, error } = await db
    .from("courses")
    .update(dbUpdates)
    .eq("id", courseId)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (error || !data) return null;
  return mapCourseRow(data);
}

export async function deleteCourse(courseId: string, userId: string): Promise<boolean> {
  const db = getDb();
  // Scope the delete to the owner and read back the affected row so a
  // not-owned (or missing) course yields false → the route answers 404.
  const { data, error } = await db
    .from("courses")
    .delete()
    .eq("id", courseId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  return !error && !!data;
}

export async function addDeckToCourse(
  courseId: string,
  userId: string,
  deckId: string,
  position = 0
): Promise<boolean> {
  // Both the course AND the deck must belong to the caller: without the deck
  // check a user could attach someone else's deck and read its metadata back
  // through listDecksInCourse.
  const course = await getCourse(courseId, userId);
  if (!course) return false;
  const deck = await getDeck(deckId, userId);
  if (!deck) return false;
  const db = getDb();
  const { error } = await db
    .from("course_decks")
    .upsert({ course_id: courseId, deck_id: deckId, position }, { onConflict: "course_id,deck_id" });
  return !error;
}

export async function removeDeckFromCourse(courseId: string, userId: string, deckId: string): Promise<boolean> {
  // Only the course owner may unlink a deck from it.
  const course = await getCourse(courseId, userId);
  if (!course) return false;
  const db = getDb();
  const { error } = await db
    .from("course_decks")
    .delete()
    .eq("course_id", courseId)
    .eq("deck_id", deckId);
  return !error;
}

// Returns null when the course isn't owned by userId (so the route can 404
// without leaking existence); an empty array means the course is owned but has
// no decks.
export async function listDecksInCourse(courseId: string, userId: string): Promise<DeckRecord[] | null> {
  const course = await getCourse(courseId, userId);
  if (!course) return null;
  const db = getDb();
  const { data, error } = await db
    .from("course_decks")
    // Zähler wie in listDecks: Bild-Occlusion-Karten sind ein eigener Modus und
    // zählen nicht als „Karten" des Decks. Der Filterpfad ist hier zweistufig,
    // weil cards eine Ebene tiefer hängt: course_decks → decks → cards.
    .select("deck_id, position, decks(*, cards(count))")
    .neq("decks.cards.card_type", "occlusion")
    .is("decks.cards.deleted_at", null)
    .eq("course_id", courseId)
    .order("position", { ascending: true });
  if (error) throw new Error(`listDecksInCourse: ${error.message}`);
  return (data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => r.decks && !r.decks.deleted_at && r.decks.user_id === userId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => mapDeckRow(r.decks));
}

export async function listCoursesForDeck(deckId: string): Promise<CourseRecord[]> {
  const db = getDb();
  const { data, error } = await db
    .from("course_decks")
    .select("courses(*)")
    .eq("deck_id", deckId);
  if (error) throw new Error(`listCoursesForDeck: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).filter((r: any) => r.courses).map((r: any) => mapCourseRow(r.courses));
}

// ─── Folders ─────────────────────────────────────────────────────────────────

export interface FolderRecord {
  id: string;
  userId: string;
  title: string;
  parentId: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFolderRow(row: any): FolderRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    parentId: row.parent_id ?? null,
    color: row.color ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createFolder(
  userId: string,
  title: string,
  parentId?: string,
  color?: string
): Promise<FolderRecord> {
  const db = getDb();
  const { data, error } = await db
    .from("folders")
    .insert({
      user_id: userId,
      title,
      parent_id: parentId ?? null,
      color: color ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`createFolder: ${error.message}`);
  return mapFolderRow(data);
}

export async function listFolders(userId: string): Promise<FolderRecord[]> {
  const db = getDb();
  const { data, error } = await db
    .from("folders")
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listFolders: ${error.message}`);
  return (data ?? []).map(mapFolderRow);
}

// Folder accessors are scoped to the owning user_id for the same IDOR reason as
// courses: the admin client bypasses RLS, so ownership is enforced here.
export async function getFolder(folderId: string, userId: string): Promise<FolderRecord | null> {
  const db = getDb();
  const { data, error } = await db
    .from("folders")
    .select()
    .eq("id", folderId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return mapFolderRow(data);
}

export async function updateFolder(
  folderId: string,
  userId: string,
  updates: Partial<Pick<FolderRecord, "title" | "parentId" | "color">>
): Promise<FolderRecord | null> {
  const db = getDb();
  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.parentId !== undefined) dbUpdates.parent_id = updates.parentId;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  const { data, error } = await db
    .from("folders")
    .update(dbUpdates)
    .eq("id", folderId)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (error || !data) return null;
  return mapFolderRow(data);
}

export async function deleteFolder(folderId: string, userId: string): Promise<boolean> {
  const db = getDb();
  // Scope to the owner and read back the affected row so a not-owned (or
  // missing) folder yields false → the route answers 404.
  const { data, error } = await db
    .from("folders")
    .delete()
    .eq("id", folderId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  return !error && !!data;
}

export async function addDeckToFolder(folderId: string, userId: string, deckId: string): Promise<boolean> {
  // Both the folder AND the deck must belong to the caller (see addDeckToCourse).
  const folder = await getFolder(folderId, userId);
  if (!folder) return false;
  const deck = await getDeck(deckId, userId);
  if (!deck) return false;
  const db = getDb();
  const { error } = await db
    .from("folder_decks")
    .upsert({ folder_id: folderId, deck_id: deckId }, { onConflict: "folder_id,deck_id" });
  return !error;
}

export async function removeDeckFromFolder(folderId: string, userId: string, deckId: string): Promise<boolean> {
  // Only the folder owner may unlink a deck from it.
  const folder = await getFolder(folderId, userId);
  if (!folder) return false;
  const db = getDb();
  const { error } = await db
    .from("folder_decks")
    .delete()
    .eq("folder_id", folderId)
    .eq("deck_id", deckId);
  return !error;
}

// Returns null when the folder isn't owned by userId (route → 404); an empty
// array means the folder is owned but has no decks.
export async function listDecksInFolder(folderId: string, userId: string): Promise<DeckRecord[] | null> {
  const folder = await getFolder(folderId, userId);
  if (!folder) return null;
  const db = getDb();
  const { data, error } = await db
    .from("folder_decks")
    // Zähler wie in listDecks / listDecksInCourse: Occlusion-Karten zählen nicht
    // als „Karten" des Decks, der Filterpfad geht über folder_decks → decks → cards.
    .select("deck_id, decks(*, cards(count))")
    .neq("decks.cards.card_type", "occlusion")
    .is("decks.cards.deleted_at", null)
    .eq("folder_id", folderId);
  if (error) throw new Error(`listDecksInFolder: ${error.message}`);
  return (data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => r.decks && !r.decks.deleted_at && r.decks.user_id === userId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => mapDeckRow(r.decks));
}

export async function listFoldersForDeck(deckId: string): Promise<FolderRecord[]> {
  const db = getDb();
  const { data, error } = await db
    .from("folder_decks")
    .select("folders(*)")
    .eq("deck_id", deckId);
  if (error) throw new Error(`listFoldersForDeck: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).filter((r: any) => r.folders).map((r: any) => mapFolderRow(r.folders));
}

// ─── Deck Sharing & Duplication ──────────────────────────────────────────────

export async function getDeckShareToken(deckId: string, userId: string): Promise<string | null> {
  const db = getDb();
  const { data, error } = await db
    .from("decks")
    .select("share_token")
    .eq("id", deckId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return data.share_token ?? null;
}

export async function setDeckShareToken(deckId: string, userId: string, shareToken: string): Promise<DeckRecord | null> {
  const db = getDb();
  const { data, error } = await db
    .from("decks")
    .update({ share_token: shareToken, updated_at: new Date().toISOString() })
    .eq("id", deckId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select()
    .maybeSingle();
  if (error || !data) return null;
  return mapDeckRow(data);
}

export async function getDeckByShareToken(shareToken: string): Promise<DeckRecord | null> {
  const db = getDb();
  const { data, error } = await db
    .from("decks")
    .select()
    .eq("share_token", shareToken)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return mapDeckRow(data);
}

export async function duplicateDeck(
  userId: string,
  sourceDeckId: string,
  newTitle: string
): Promise<DeckRecord> {
  const db = getDb();
  // Create the new deck
  const { data: deckData, error: deckError } = await db
    .from("decks")
    .insert({
      user_id: userId,
      title: newTitle,
      source_deck_id: sourceDeckId,
    })
    .select()
    .single();
  if (deckError) throw new Error(`duplicateDeck: ${deckError.message}`);

  const newDeckId = deckData.id;

  // Copy all cards from source deck
  const { data: cards, error: cardsError } = await db
    .from("cards")
    .select()
    .eq("deck_id", sourceDeckId)
    .is("deleted_at", null);
  if (cardsError) throw new Error(`duplicateDeck cards: ${cardsError.message}`);

  if (cards && cards.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newCards = cards.map((c: any) => ({
      user_id: userId,
      deck_id: newDeckId,
      front: c.front,
      back: c.back,
      card_type: c.card_type ?? "basic",
      difficulty: c.difficulty ?? "medium",
      tags: c.tags ?? [],
      fsrs_due: new Date().toISOString(),
      fsrs_stability: 0,
      fsrs_difficulty: 0,
      fsrs_state: "new",
      fsrs_reps: 0,
      fsrs_lapses: 0,
    }));
    const { error: insertError } = await db.from("cards").insert(newCards);
    if (insertError) throw new Error(`duplicateDeck insertCards: ${insertError.message}`);
  }

  return mapDeckRow(deckData);
}

// ─── Deck / Card Limit Checks ────────────────────────────────────────────────

export async function countUserDecks(userId: string): Promise<number> {
  const db = getDb();
  const { count } = await db
    .from("decks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null);
  return count ?? 0;
}

export async function countUserCards(userId: string): Promise<number> {
  const db = getDb();
  const { count } = await db
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null);
  return count ?? 0;
}

/**
 * Deck ids of a user in one canonical order (oldest first, id as tie-breaker).
 * Used by the import capacity guard (#411): the same order is computed by every
 * concurrent writer, so all of them agree on which decks are "within the plan"
 * and which one is the overflow that has to go — without a shared transaction.
 */
export async function listDeckIdsForUser(userId: string): Promise<string[]> {
  const db = getDb();
  const { data, error } = await db
    .from("decks")
    .select("id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(`listDeckIdsForUser: ${error.message}`);
  return (data ?? []).map((row) => (row as { id: string }).id);
}

/**
 * Card ids of one deck in the same canonical order as `listDeckIdsForUser`.
 * Deliberately counts EVERY live card (image-occlusion cards included), which
 * is exactly what `assertCardLimit` on the manual path counts, so both paths
 * enforce the same number.
 */
export async function listCardIdsForDeck(userId: string, deckId: string): Promise<string[]> {
  const db = getDb();
  const { data, error } = await db
    .from("cards")
    .select("id")
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(`listCardIdsForDeck: ${error.message}`);
  return (data ?? []).map((row) => (row as { id: string }).id);
}

/**
 * Soft-deletes a known set of cards of one deck. Only used to take back cards
 * this very request has just inserted (#411), never user-facing data — hence
 * the hard scoping to user + deck + explicit id list. Soft delete keeps the
 * repo-wide "nothing is ever really deleted" rule; every count filters
 * `deleted_at is null`, so the plan limit still adds up.
 */
export async function softDeleteCardsByIds(
  userId: string,
  deckId: string,
  cardIds: string[]
): Promise<number> {
  if (cardIds.length === 0) return 0;
  const db = getDb();
  const { data, error } = await db
    .from("cards")
    .update({ deleted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .in("id", cardIds)
    .is("deleted_at", null)
    .select("id");
  if (error) throw new Error(`softDeleteCardsByIds: ${error.message}`);
  return (data ?? []).length;
}

export async function getDeckWithCardCount(deckId: string, userId: string): Promise<(DeckRecord & { cardCount: number }) | null> {
  const db = getDb();
  const { data: deck, error: deckError } = await db
    .from("decks")
    .select()
    .eq("id", deckId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (deckError || !deck) return null;

  const { count } = await db
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("deck_id", deckId)
    .is("deleted_at", null);

  return { ...mapDeckRow(deck), cardCount: count ?? 0 };
}

// ─── Per-deck review stats (#246) ────────────────────────────────────────────

// "Correct" mirrors getReviewStats' accuracy definition: rating >= 3
// (3 = good, 4 = easy); again (1) and hard (2) count as wrong.
const CORRECT_RATING_MIN = 3;

/** The last `n` UTC calendar dates (oldest first, ending today). */
function lastNDayKeysUtc(now: Date, n: number): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(
      new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split("T")[0] ?? ""
    );
  }
  return keys;
}

/**
 * Review stats for ONE deck over the last `days` days: total/correct answers
 * plus the per-day accuracy trend. Like getReviewStats, `accuracyByDay` keeps
 * only days that actually have reviews. The deck scope comes from joining
 * review_logs → cards on card_id; callers verify deck ownership beforehand
 * (the additional user_id filter here is defense in depth).
 */
export async function getDeckReviewStats(
  userId: string,
  deckId: string,
  days = 30
): Promise<{
  answersTotal: number;
  answersCorrect: number;
  accuracyByDay: Array<{ date: string; accuracy: number; count: number }>;
}> {
  const db = getDb();
  const dayKeys = lastNDayKeysUtc(new Date(), days);
  const windowStart = `${dayKeys[0]}T00:00:00.000Z`;

  // Paged: oldest-first, so one page would silently drop this deck's newest
  // days — and answersTotal/answersCorrect are summed from these very rows.
  const data = await selectAllRows<{ rating: number | null; reviewed_at: string }>(
    (from, to) =>
      db
        .from("review_logs")
        .select("rating, reviewed_at, cards!inner(deck_id)")
        .eq("user_id", userId)
        .eq("cards.deck_id", deckId)
        .gte("reviewed_at", windowStart)
        .order("reviewed_at", { ascending: true })
        .range(from, to),
    "getDeckReviewStats"
  );

  const dayStats: Record<string, { count: number; good: number }> = {};
  for (const key of dayKeys) dayStats[key] = { count: 0, good: 0 };

  let answersTotal = 0;
  let answersCorrect = 0;
  for (const row of (data ?? []) as Array<{ rating: number | null; reviewed_at: string }>) {
    answersTotal += 1;
    const correct = (row.rating ?? 0) >= CORRECT_RATING_MIN;
    if (correct) answersCorrect += 1;
    const day = row.reviewed_at.split("T")[0] ?? "";
    const bucket = dayStats[day];
    if (!bucket) continue; // outside the scaffolded window (defensive)
    bucket.count += 1;
    if (correct) bucket.good += 1;
  }

  const accuracyByDay = dayKeys
    .filter((date) => (dayStats[date]?.count ?? 0) > 0)
    .map((date) => {
      const s = dayStats[date] ?? { count: 0, good: 0 };
      return {
        date,
        count: s.count,
        accuracy: s.count > 0 ? Math.round((s.good / s.count) * 100) / 100 : 0,
      };
    });

  return { answersTotal, answersCorrect, accuracyByDay };
}

/**
 * The deck's "Wackelkandidaten": cards with the most wrong answers (all time),
 * most-wrong first, ties broken by the most recent wrong answer. Only cards
 * with at least one wrong answer appear; soft-deleted cards are excluded
 * because the client offers to practice the result.
 */
export async function getDeckWobblyCards(
  userId: string,
  deckId: string,
  limit = 5
): Promise<
  Array<{ cardId: string; front: string; back: string; wrongCount: number; lastWrongAt: string }>
> {
  const db = getDb();
  const { data, error } = await db
    .from("review_logs")
    .select("card_id, reviewed_at, cards!inner(deck_id, front, back, deleted_at)")
    .eq("user_id", userId)
    .eq("cards.deck_id", deckId)
    .is("cards.deleted_at", null)
    // Wackelkandidaten are offered as a flashcard round, but an occlusion card's
    // front is only a placeholder ("Was ist an der markierten Stelle?") — without
    // its image it cannot be practised outside the Bild-Abdecken mode.
    .neq("cards.card_type", "occlusion")
    .lt("rating", CORRECT_RATING_MIN);
  if (error) throw new Error(`getDeckWobblyCards: ${error.message}`);

  const byCard = new Map<
    string,
    { front: string; back: string; wrongCount: number; lastWrongAt: string }
  >();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    const cardId = row.card_id as string | null;
    if (!cardId) continue;
    const existing = byCard.get(cardId);
    const reviewedAt = (row.reviewed_at as string | null) ?? "";
    if (existing) {
      existing.wrongCount += 1;
      if (reviewedAt > existing.lastWrongAt) existing.lastWrongAt = reviewedAt;
    } else {
      byCard.set(cardId, {
        front: row.cards?.front ?? "",
        back: row.cards?.back ?? "",
        wrongCount: 1,
        lastWrongAt: reviewedAt,
      });
    }
  }

  return [...byCard.entries()]
    .map(([cardId, s]) => ({ cardId, ...s }))
    .sort(
      (a, b) =>
        b.wrongCount - a.wrongCount || b.lastWrongAt.localeCompare(a.lastWrongAt)
    )
    .slice(0, limit);
}

/**
 * Per-deck answer summaries for ALL of the user's decks over the last `days`
 * days, in two queries (decks + windowed review logs) instead of N. Decks
 * without any answers are included with answersTotal 0 (LEFT-join style).
 * Uses the same day-aligned window as getDeckReviewStats so the list
 * percentage matches the deck detail's ring.
 */
export async function getDeckReviewSummaries(
  userId: string,
  days = 30
): Promise<Array<{ deckId: string; title: string; answersTotal: number; accuracyRate: number }>> {
  const db = getDb();
  const dayKeys = lastNDayKeysUtc(new Date(), days);
  const windowStart = `${dayKeys[0]}T00:00:00.000Z`;

  const { data: decks, error: decksError } = await db
    .from("decks")
    .select("id, title")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (decksError) throw new Error(`getDeckReviewSummaries: ${decksError.message}`);

  // Paged, and explicitly ordered: paging by row range is only well-defined
  // under a stable sort. Without an ORDER BY the database may return rows in
  // any order it likes, and two pages could then overlap or skip — which is
  // worse than the truncation being fixed. Unpaged, a busy month silently cut
  // this to an arbitrary 1000 rows and skewed every deck's percentage.
  const logs = await selectAllRows<{
    rating: number | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cards?: any;
  }>(
    (from, to) =>
      db
        .from("review_logs")
        .select("rating, cards!inner(deck_id)")
        .eq("user_id", userId)
        .gte("reviewed_at", windowStart)
        .order("reviewed_at", { ascending: true })
        .range(from, to),
    "getDeckReviewSummaries"
  );

  const byDeck = new Map<string, { total: number; good: number }>();
  for (const row of logs) {
    const rowDeckId = row.cards?.deck_id as string | null;
    if (!rowDeckId) continue;
    const s = byDeck.get(rowDeckId) ?? { total: 0, good: 0 };
    s.total += 1;
    if ((row.rating ?? 0) >= CORRECT_RATING_MIN) s.good += 1;
    byDeck.set(rowDeckId, s);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((decks ?? []) as any[]).map((deck) => {
    const s = byDeck.get(deck.id) ?? { total: 0, good: 0 };
    return {
      deckId: deck.id as string,
      title: (deck.title as string | null) ?? "",
      answersTotal: s.total,
      accuracyRate: s.total > 0 ? Math.round((s.good / s.total) * 100) / 100 : 0,
    };
  });
}
