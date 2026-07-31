/**
 * Supabase-backed data access layer.
 * Replaces the in-memory store with persistent Postgres storage.
 * All functions are async and map between camelCase (code) and snake_case (DB).
 */

import { createSupabaseAdminClient } from "./supabase";
import { daysBetween, startOfLocalDayIso, startOfTodayLocalIso, todayLocal } from "./localDay";
import { STREAK_REPAIR } from "./featureGates";
import {
  deriveCardType,
  RECALL_MODES,
  RECOGNITION_MODES,
  type Flashcard,
  type ReviewMode,
  type SubscriptionTier,
  type TestAttemptSummary,
} from "./contracts";

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
  /**
   * Vorlese-Sprachen des Decks, getrennt nach Seite (#571). `null` heißt „nicht
   * eingestellt" — die Clients lesen dann Deutsch. Getrennt, weil Vokabelkarten
   * zweisprachig sind: vorne „les données", hinten „die Daten".
   */
  speechLangFront?: string | null;
  speechLangBack?: string | null;
  deletedAt?: string | null;
  /**
   * Wann das Deck archiviert wurde (#614). `null` = aktiv.
   *
   * Archiviert heißt: raus aus Bibliothek und Fällig-Stapel, aber vollständig
   * erhalten und auf Knopfdruck zurück. Anders als beim Papierkorb ist hier
   * nichts gelöscht — deshalb zählt ein archiviertes Deck weiter gegen die
   * Deck-Grenze des Tarifs. Täte es das nicht, wäre Archivieren ein Weg um
   * die Grenze herum.
   */
  archivedAt?: string | null;
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
    speechLangFront: row.speech_lang_front ?? null,
    speechLangBack: row.speech_lang_back ?? null,
    deletedAt: row.deleted_at ?? null,
    archivedAt: row.archived_at ?? null,
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

/**
 * Decks des Nutzers.
 *
 * `archived` entscheidet, welche Hälfte kommt (#614): standardmäßig die aktiven
 * (Bibliothek), mit `true` die archivierten (Archiv-Ansicht). Bewusst ein
 * Entweder-oder statt „alle mit Kennzeichen": Jeder bestehende Aufrufer will
 * die Bibliothek, und ein vergessener Filter würde archivierte Decks überall
 * wieder einblenden — das wäre genau der Fehler, den Archivieren beheben soll.
 */
export async function listDecks(
  userId: string,
  options: { archived?: boolean } = {}
): Promise<DeckRecord[]> {
  const db = getDb();
  const archivedOnly = options.archived === true;
  let query = db
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
    .is("deleted_at", null);
  query = archivedOnly
    ? query.not("archived_at", "is", null)
    : query.is("archived_at", null);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(`listDecks: ${error.message}`);

  // Bild-Karten separat zählen. Sie im eingebetteten Zähler mitzuzählen ginge
  // nicht: PostgREST kann dieselbe eingebettete Beziehung nicht zweimal
  // unterschiedlich filtern. Deshalb EINE zusätzliche schlanke Abfrage (nicht
  // pro Deck — kein N+1), die anschließend zugeordnet wird. Seitenweise (#612):
  // ab 1000 Bild-Karten im Konto kappte PostgREST die Liste still und die
  // Zähler logen.
  const imageRows = await selectAllRows<{ deck_id: string | null }>(
    (from, to) =>
      db
        .from("cards")
        .select("deck_id")
        .eq("user_id", userId)
        .eq("card_type", "occlusion")
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(from, to),
    "listDecks (Bild-Karten)"
  );

  const imagesByDeck = new Map<string, number>();
  for (const row of imageRows) {
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
  updates: Partial<
    Pick<DeckRecord, "title" | "tags" | "speechLangFront" | "speechLangBack">
  >
): Promise<DeckRecord | null> {
  const db = getDb();
  const dbUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
  // `null` schreibt die Spalte bewusst leer („Sprache wieder entfernen"); nur
  // ein fehlendes Feld lässt sie unberührt.
  if (updates.speechLangFront !== undefined) {
    dbUpdates.speech_lang_front = updates.speechLangFront;
  }
  if (updates.speechLangBack !== undefined) {
    dbUpdates.speech_lang_back = updates.speechLangBack;
  }

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

/**
 * Deck archivieren oder zurückholen (#614).
 *
 * Ein einzelner Zeitstempel, wie bei `deleted_at`: setzen heißt archivieren,
 * `null` heißt aktiv. Gelöschte Decks bleiben außen vor — was im Papierkorb
 * liegt, wird nicht nebenbei archiviert.
 *
 * Die Karten werden NICHT mitmarkiert (anders als beim Löschen): Sie sollen
 * beim Zurückholen exakt so wiederkommen, wie sie waren, und die Karten-Grenze
 * zählt sie ohnehin weiter mit.
 */
export async function setDeckArchived(
  deckId: string,
  userId: string,
  archived: boolean
): Promise<DeckRecord | null> {
  const db = getDb();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("decks")
    .update({ archived_at: archived ? now : null, updated_at: now })
    .eq("id", deckId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select()
    .maybeSingle();
  if (error) throw new Error(`setDeckArchived: ${error.message}`);
  return data ? mapDeckRow(data) : null;
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
  if (error || !data) return false;

  // Die Karten des Decks mit demselben Zeitstempel mitmarkieren (#495): sie
  // zählen sonst in countUserCards ewig gegen das Karten-Limit. Reihenfolge
  // Deck -> Karten, nicht andersherum: schlägt dieser zweite Schritt fehl,
  // bleiben unsichtbare Karten übrig (die gehärteten Leser joinen auf lebende
  // Decks); andersherum stünde ein sichtbar leergeräumtes, lebendes Deck da.
  const { error: cardsError } = await db
    .from("cards")
    .update({ deleted_at: now })
    .eq("deck_id", deckId)
    .eq("user_id", userId)
    .is("deleted_at", null);
  if (cardsError) {
    console.error("[softDeleteDeck] cards not marked:", cardsError.message);
  }
  return true;
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
      // basic↔cloze folgt der Markierung im Text, nicht der Client-Angabe —
      // hier für JEDEN Einfügeweg, damit kein Endpunkt sie vergessen kann.
      card_type: deriveCardType(card.front, card.type),
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
        card_type: deriveCardType(card.front, card.type),
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
  // Seitenweise laden: ein Pro-Deck darf 2.000 Karten haben, PostgREST liefert
  // aber höchstens 1000 Zeilen pro Anfrage und schweigt über den Rest — Karte
  // 1001+ war damit unsichtbar und unlernbar (#612). Die deterministische
  // Sortierung unten macht das Blättern zugleich lückenlos.
  const rows = await selectAllRows<Record<string, unknown>>(
    (from, to) =>
      db
        .from("cards")
        .select()
        .eq("user_id", userId)
        .eq("deck_id", deckId)
        .is("deleted_at", null)
        // Stabiler Zweitschlüssel: Scan-/Import-Karten teilen sich denselben
        // created_at (ein Batch-Insert). Ohne zweite Sortierspalte darf Postgres
        // sie bei jedem Aufruf anders anordnen — nach dem Lernen sprang so die
        // Karten-Reihenfolge auf der Deck-Seite (#499). id ist eindeutig und macht
        // die Reihenfolge deterministisch, ohne die Erstellungs-Ordnung zu ändern.
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    "listCardsForDeck"
  );
  return rows.map(mapCardRow);
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
    // softDeleteDeck markiert historisch nur das Deck, nicht dessen Karten —
    // ohne den inner join auf lebende Decks zählen Karten aus gelöschten
    // Decks ewig weiter und die Fällig-Zahl lügt (#495).
    .select("*, decks!inner(deleted_at, archived_at)")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .is("decks.deleted_at", null)
    // Archivierte Decks fallen aus dem Fällig-Stapel (#614) — genau dafür
    // archiviert man. Derselbe Filter steht in countDueCards und
    // countDueCardsByDeck: fehlte er in einer, verspräche das Abzeichen Karten,
    // die die Lernrunde nicht liefert.
    .is("decks.archived_at", null)
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

/**
 * How many cards are due — same filters as listDueCards, but counted by the
 * database (`head: true` ships no rows). For display counts (stats page):
 * fetching every due card with full front/back text only to take `.length`
 * moves the whole backlog over the wire, and — unlike listDueCards, which
 * /learn/due consumes page-unaware — a count can't be silently truncated by
 * PostgREST's row cap. Keep both in sync: a filter added to one without the
 * other makes the count promise cards the learn round won't serve.
 */
export async function countDueCards(userId: string, nowIso: string): Promise<number> {
  const db = getDb();
  const { count, error } = await db
    .from("cards")
    .select("*, decks!inner(deleted_at, archived_at)", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null)
    .is("decks.deleted_at", null)
    // Archivierte Decks fallen aus dem Fällig-Stapel (#614) — genau dafür
    // archiviert man. Derselbe Filter steht in listDueCards, countDueCards und
    // countDueCardsByDeck: fehlte er in einer, verspräche das Abzeichen Karten,
    // die die Lernrunde nicht liefert.
    .is("decks.archived_at", null)
    .neq("card_type", "occlusion")
    .lte("fsrs_due", nowIso);
  if (error) throw new Error(`countDueCards: ${error.message}`);
  return count ?? 0;
}

/**
 * Due counts grouped by deck — the "N fällig" badges in the library and folder
 * views. Same filter set as listDueCards/countDueCards (live deck via inner
 * join, card not deleted, occlusion excluded, fsrs_due <= now); a filter added
 * to one but not the others makes the badge promise cards the learn round
 * won't serve. PostgREST can't GROUP BY without an RPC, so this fetches only
 * the deck_id column (a few bytes per row instead of full card text) through
 * selectAllRows and groups here — a backlog past the row cap still counts.
 */
export async function countDueCardsByDeck(
  userId: string,
  nowIso: string
): Promise<Record<string, number>> {
  const db = getDb();
  const rows = await selectAllRows<{ deck_id: string }>(
    (from, to) =>
      db
        .from("cards")
        .select("deck_id, decks!inner(deleted_at, archived_at)")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .is("decks.deleted_at", null)
        .is("decks.archived_at", null)
        .neq("card_type", "occlusion")
        .lte("fsrs_due", nowIso)
        // Ohne deterministische Sortierung dürfen sich Seiten überlappen oder
        // Zeilen auslassen — id ist eindeutig, das reicht fürs Blättern.
        .order("id", { ascending: true })
        .range(from, to),
    "countDueCardsByDeck"
  );
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.deck_id] = (counts[row.deck_id] ?? 0) + 1;
  return counts;
}

/**
 * Wann wurde in jedem Deck zuletzt gelernt? (#614, Sortierung „zuletzt gelernt")
 *
 * Der Zeitpunkt steckt nur in `review_logs`; am Deck selbst gibt es ihn nicht.
 * `updated_at` taugt nicht als Ersatz — das ändert sich beim Umbenennen und
 * beim Bearbeiten von Karten, also auch ohne eine einzige Antwort.
 *
 * Aggregiert wird im Client-Code über die Zeilen, nicht per SQL-Gruppierung:
 * PostgREST kann kein `group by`, und die Alternative wäre eine Datenbank-
 * Funktion — für eine Sortierreihenfolge zu viel. Übertragen werden nur zwei
 * Spalten, und `selectAllRows` blättert über die stille 1000er-Kappung hinweg
 * (#612), sonst wären ausgerechnet die NEUESTEN Tage abgeschnitten.
 *
 * `decks!inner` mit Liveness-Filter (#495): weich gelöschte Decks und Karten
 * zählen nicht, sonst stünde ein Deck aus dem Papierkorb in der Sortierung.
 * Decks ohne jede Antwort fehlen im Ergebnis — Clients lesen fehlend als „noch
 * nie gelernt".
 */
export async function getLastLearnedByDeck(
  userId: string
): Promise<Record<string, string>> {
  const db = getDb();
  const rows = await selectAllRows<Record<string, unknown>>(
    (from, to) =>
      db
        .from("review_logs")
        .select("reviewed_at, cards!inner(deck_id, deleted_at, decks!inner(deleted_at))")
        .eq("user_id", userId)
        .is("cards.deleted_at", null)
        .is("cards.decks.deleted_at", null)
        // Deterministisch blättern: ohne feste Ordnung dürfen sich Seiten
        // überlappen oder Zeilen auslassen.
        .order("id", { ascending: true })
        .range(from, to),
    "getLastLearnedByDeck"
  );

  const latest: Record<string, string> = {};
  for (const row of rows) {
    // Die eingebettete Beziehung kommt als Objekt zurück, wird von den
    // PostgREST-Typen aber als Array beschrieben — beide Formen lesen, statt
    // sich auf eine zu verlassen.
    const embedded = (row as { cards?: unknown }).cards;
    const card = (Array.isArray(embedded) ? embedded[0] : embedded) as
      | { deck_id?: string }
      | undefined;
    const deckId = card?.deck_id;
    const reviewedAt = row.reviewed_at as string | undefined;
    if (!deckId || !reviewedAt) continue;
    const known = latest[deckId];
    if (!known || reviewedAt > known) latest[deckId] = reviewedAt;
  }
  return latest;
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
    // inner join auf lebende Decks: sonst findet die Suche Karten aus weich
    // gelöschten Decks und zeigt sogar deren alten Titel an (#495).
    .select("id, deck_id, front, back, decks!inner(title, deleted_at)")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .is("decks.deleted_at", null)
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
  /** Trefferquote getrennt nach Art der Antwort — abgerufen (aus dem Kopf)
   *  gegen wiedererkannt (aus einer Auswahl getippt). `answers` ist der eigene
   *  Nenner der Gruppe; 0 heißt „in diesem Zeitraum nichts davon gemacht" und
   *  soll als Strich angezeigt werden, nicht als 0 %. Prüfungen zählen in
   *  keiner der beiden Gruppen. */
  accuracyByKind: {
    recall: { rate: number; answers: number };
    recognition: { rate: number; answers: number };
  };
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

  // reviewsToday/Week/Total sind MENGEN („wie viel hast du getan"), keine
  // Quoten. Sie zählen Prüfungen bewusst MIT — Laras Entscheidung vom 17.07.:
  // „alles was ich gemacht habe soll zählen, auch Prüfungen." reviewsToday
  // speist den Tagesziel-Balken (reviewsToday / dailyGoal); direkt daneben
  // zeigt „Karten pro Tag" (reviewsByDay) dieselbe Menge — beide MÜSSEN gleich
  // zählen, sonst stehen zwei „heute"-Zahlen verschieden nebeneinander.
  //
  // Die QUOTEN dagegen (accuracyRate, accuracyByDay, accuracyByKind) lassen
  // Prüfungen aus (`.neq("mode","test")` unten): eine Prüfung misst unter Druck
  // und würde die Lern-Trefferquote sonst drücken — sie bekommt ihre eigene
  // Quote im Prüfungs-Bereich. Sonst stünden auf einer Seite mehrere „wie gut"-
  // Zahlen, die dieselbe Prüfung verschieden verrechnen.
  //
  // Ungefährlich fürs Tagesziel, weil daran keine Prämie mehr hängt (LP dafür
  // entfernt) und der Streak jeder Antwort folgt, nicht dem Ziel. Was Prüfungen
  // ausserdem NICHT tun: Lernpunkte geben (earn_session_lp überspringt sie) und
  // den Lernplan bewegen (reviewService, außer bei Fehlern).
  // Alle Zählungen werden erst GEBAUT und unten in EINEM Promise.all
  // abgeschickt — sie sind voneinander unabhängig, und nacheinander wären es
  // sechs volle Netzwerk-Wartezeiten statt einer (#492).
  const todayCountQuery = db
    .from("review_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("reviewed_at", todayStart);

  // Reviews this week
  const weekCountQuery = db
    .from("review_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("reviewed_at", weekStart);

  // Reviews total
  const totalCountQuery = db
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
  // `.neq("mode","test")`: die Trefferquote ist eine QUOTE und lässt Prüfungen
  // aus (siehe der Menge-gegen-Quote-Absatz über todayCount). Sonst zeigte
  // dieselbe Seite mehrere „wie gut"-Zahlen, die dieselbe Prüfung verschieden
  // verrechnen. Der Nenner reviewsInWindow wandert mit — der Client beschriftet
  // die Quote damit („X Antworten"), und Zähler und Nenner müssen dieselbe
  // Menge meinen.
  const windowTotalCountQuery = db
    .from("review_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("reviewed_at", windowStart)
    .neq("mode", "test");

  const windowGoodCountQuery = db
    .from("review_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("reviewed_at", windowStart)
    .neq("mode", "test")
    .gte("rating", 3); // 3=good, 4=easy

  // Dieselbe Trefferquote, aufgeteilt nach der Art der Antwort. Die
  // Gesamtzahl mischt zwei verschiedene Leistungen: „ich wusste es" (Karte
  // umgedreht, selbst bewertet) und „ich habe die richtige von vier Kacheln
  // getroffen". Seit Quiz/Zuordnen zählen, hebt Raten die Quote, ohne dass
  // eine Karte aus dem Kopf kam — die eine Zahl wird dadurch schmeichelhaft.
  //
  // `test` bleibt in beiden Gruppen außen vor: die Prüfung bekommt einen
  // eigenen Bereich. Die Gruppen summieren sich deshalb NICHT auf
  // `reviewsInWindow` — jede Gruppe bringt ihren eigenen Nenner mit, damit
  // ein Client "keine Antworten" von "alle falsch" unterscheiden kann.
  const countInWindow = async (modes: readonly ReviewMode[], onlyGood: boolean) => {
    let q = db
      .from("review_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("reviewed_at", windowStart)
      .in("mode", [...modes]);
    if (onlyGood) q = q.gte("rating", 3);
    const { count } = await q;
    return count ?? 0;
  };
  // Die Gruppen-Zählungen starten hier (nicht erst im Promise.all-Array),
  // damit die Abfrage-Reihenfolge stabil bleibt: Zählungen zuerst, die
  // Tageszeilen als letzte — darauf verlässt sich die Test-Attrappe
  // (reviewStatsDb.test.ts), die Antworten der Reihe nach ausgibt.
  const recallTotalPromise = countInWindow(RECALL_MODES, false);
  const recallGoodPromise = countInWindow(RECALL_MODES, true);
  const recognitionTotalPromise = countInWindow(RECOGNITION_MODES, false);
  const recognitionGoodPromise = countInWindow(RECOGNITION_MODES, true);

  // Daily counts + learn time for the requested window (bar chart, trend,
  // per-day detail). `review_duration_ms` is nullable — treat null as 0.
  // Paged: sorted oldest-first, a single page would drop the newest days of a
  // busy month — the bar chart would show 0 cards for days that were studied.
  const dailyDataPromise = selectAllRows<{
    reviewed_at: string;
    rating: number | null;
    review_duration_ms: number | null;
    mode: string | null;
  }>(
    (from, to) =>
      db
        .from("review_logs")
        .select("reviewed_at, rating, review_duration_ms, mode")
        .eq("user_id", userId)
        .gte("reviewed_at", windowStart)
        .order("reviewed_at", { ascending: true })
        .range(from, to),
    "getReviewStats"
  );

  // Das eine Bündel: neun Zählungen + Tagesverlauf gleichzeitig. Einzige
  // Serialität, die bleibt, ist das Blättern INNERHALB von selectAllRows —
  // dort erzwingt sie die Abbruchregel (Seite kürzer als der Cap).
  const [
    { count: todayCount },
    { count: weekCount },
    { count: totalCount },
    { count: windowTotalCount },
    { count: windowGoodCount },
    recallTotal,
    recallGood,
    recognitionTotal,
    recognitionGood,
    dailyData,
  ] = await Promise.all([
    todayCountQuery,
    weekCountQuery,
    totalCountQuery,
    windowTotalCountQuery,
    windowGoodCountQuery,
    recallTotalPromise,
    recallGoodPromise,
    recognitionTotalPromise,
    recognitionGoodPromise,
    dailyDataPromise,
  ]);

  const total = totalCount ?? 0;
  const windowTotal = windowTotalCount ?? 0;
  const windowGood = windowGoodCount ?? 0;
  const accuracyRate = windowTotal > 0 ? windowGood / windowTotal : 0;

  // Zwei Zähler je Tag, weil hier MENGE und QUOTE nebeneinander wohnen:
  //  - count/durationMs zählen ALLES (auch Prüfungen) -> reviewsByDay „Karten
  //    pro Tag" und die Lernzeit, dieselbe Menge wie reviewsToday.
  //  - quotaCount/good zählen ohne Prüfung -> accuracyByDay, dieselbe Regel wie
  //    die Fenster-Trefferquote oben. Liefen sie zusammen, drückte eine Prüfung
  //    den Tagespunkt im Verlauf, obwohl sie in der Gesamt-Trefferquote fehlt.
  const dayStats: Record<
    string,
    { count: number; quotaCount: number; good: number; durationMs: number }
  > = {};
  for (const key of dayKeys) {
    dayStats[key] = { count: 0, quotaCount: 0, good: 0, durationMs: 0 };
  }
  dailyData.forEach((r) => {
    const day = r.reviewed_at.split("T")[0] ?? "";
    const bucket = dayStats[day];
    if (!bucket) return; // outside the scaffolded window (defensive)
    bucket.count += 1;
    bucket.durationMs += r.review_duration_ms ?? 0;
    if (r.mode === "test") return; // Prüfungen aus der Quote heraus
    bucket.quotaCount += 1;
    if ((r.rating ?? 0) >= 3) bucket.good += 1;
  });
  const reviewsByDay = dayKeys.map((date) => ({
    date,
    count: dayStats[date]?.count ?? 0,
  }));
  const durationMsByDay = dayKeys.map((date) => ({
    date,
    durationMs: dayStats[date]?.durationMs ?? 0,
  }));
  // Ein Tag erscheint im Verlauf nur, wenn an ihm etwas ZÄHLENDES lief: ein
  // Tag mit ausschließlich Prüfungen hat quotaCount 0 und bekommt keinen
  // Punkt — sonst stünde dort ein 0-%-Punkt für einen Tag, an dem sehr wohl
  // gelernt (geprüft) wurde.
  const accuracyByDay = dayKeys
    .filter((date) => (dayStats[date]?.quotaCount ?? 0) > 0)
    .map((date) => {
      const s = dayStats[date] ?? { count: 0, quotaCount: 0, good: 0, durationMs: 0 };
      return {
        date,
        count: s.quotaCount,
        accuracy: s.quotaCount > 0 ? Math.round((s.good / s.quotaCount) * 100) / 100 : 0,
      };
    });

  return {
    reviewsToday: todayCount ?? 0,
    reviewsThisWeek: weekCount ?? 0,
    reviewsTotal: total,
    reviewsInWindow: windowTotal,
    accuracyRate: Math.round(accuracyRate * 100) / 100,
    accuracyByKind: {
      recall: {
        rate: recallTotal > 0 ? Math.round((recallGood / recallTotal) * 100) / 100 : 0,
        answers: recallTotal,
      },
      recognition: {
        rate:
          recognitionTotal > 0
            ? Math.round((recognitionGood / recognitionTotal) * 100) / 100
            : 0,
        answers: recognitionTotal,
      },
    },
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
): Promise<{
  tier: SubscriptionTier;
  expiresAt: string | null;
  isActive: boolean;
  billingIssueAt: string | null;
}> {
  const db = getDb();
  const { data, error } = await db
    .from("profiles")
    .select("subscription_tier, subscription_expires_at, billing_issue_at")
    .eq("id", userId)
    .maybeSingle();
  // Ein LESE-FEHLER darf nicht still zu "free" werden: an diesem Tier hängen
  // LP-Preise, Tarifgrenzen, Rate-Limits und 402-Paywalls — ein Pro-Konto
  // zahlte sonst bei jedem DB-Schluckauf Free-Preise (#607). Kein Profil
  // (ohne Fehler) heißt dagegen wirklich free.
  if (error) throw new Error(`getSubscriptionTier: ${error.message}`);
  if (!data) return { tier: "free", expiresAt: null, isActive: true, billingIssueAt: null };
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
    billingIssueAt: data.billing_issue_at ?? null,
  };
}

export async function updateSubscriptionTier(
  userId: string,
  tier: SubscriptionTier,
  isActive: boolean,
  expiresAt: string | null,
  // #607: RevenueCat BILLING_ISSUE. Wird bei JEDEM Abo-Schreibvorgang
  // mitgeschrieben (null = kein Zahlungsproblem), damit ein erledigtes
  // Problem nicht als Banner kleben bleibt.
  billingIssueAt: string | null
): Promise<void> {
  const db = getDb();
  await db
    .from("profiles")
    .update({
      subscription_tier: tier,
      subscription_expires_at: expiresAt,
      billing_issue_at: billingIssueAt,
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

// ─── Folders ─────────────────────────────────────────────────────────────────

export interface FolderRecord {
  id: string;
  userId: string;
  title: string;
  description: string | null;
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
    description: row.description ?? null,
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
  color?: string,
  description?: string
): Promise<FolderRecord> {
  const db = getDb();
  const { data, error } = await db
    .from("folders")
    .insert({
      user_id: userId,
      title,
      parent_id: parentId ?? null,
      color: color ?? null,
      description: description ?? null,
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

// Folder accessors are scoped to the owning user_id: the admin client
// bypasses RLS, so ownership (IDOR) is enforced here in code.
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
  updates: Partial<Pick<FolderRecord, "title" | "parentId" | "color" | "description">>
): Promise<FolderRecord | null> {
  const db = getDb();
  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.parentId !== undefined) dbUpdates.parent_id = updates.parentId;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  // Leerer Text löscht die Beschreibung (null), statt "" zu speichern — sonst
  // müsste jeder Leser zwischen "" und null unterscheiden.
  if (updates.description !== undefined) dbUpdates.description = updates.description || null;
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
  // Both the folder AND the deck must belong to the caller: without the deck
  // check a user could attach someone else's deck and read its metadata back.
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
    // Zähler wie in listDecks: Occlusion-Karten zählen nicht
    // als „Karten" des Decks, der Filterpfad geht über folder_decks → decks → cards.
    .select("deck_id, position, added_at, decks(*, cards(count))")
    .neq("decks.cards.card_type", "occlusion")
    .is("decks.cards.deleted_at", null)
    .eq("folder_id", folderId)
    // Eine Tabelle hat von sich aus keine Reihenfolge — ohne dieses `order`
    // liefert Postgres die Zeilen so, wie es ihm gerade passt, und dieselbe
    // Abfrage kann morgen anders herum antworten. `nulls last`: nie sortierte
    // Decks hängen hinten dran, in der Reihenfolge des Hinzufügens (#437).
    .order("position", { ascending: true, nullsFirst: false })
    .order("added_at", { ascending: true });
  if (error) throw new Error(`listDecksInFolder: ${error.message}`);
  return (data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => r.decks && !r.decks.deleted_at && r.decks.user_id === userId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => mapDeckRow(r.decks));
}

/**
 * Decks je Ordner, als Zählung über ALLE Ordner des Nutzers (#612).
 *
 * Die Bibliothek und die Ordnerseite riefen für jeden Ordner einzeln
 * listDecksInFolder auf, nur um `decks.length` zu lesen: eine Anfrage pro
 * Ordner, jede mit Deck-Titeln, Farben und Kartenzählern im Gepäck, die
 * anschließend weggeworfen wurden (N+1). Hier fließt nur folder_id.
 *
 * Ordner ohne Decks fehlen im Ergebnis — Leser lesen fehlend als 0.
 */
export async function countDecksByFolder(userId: string): Promise<Record<string, number>> {
  const db = getDb();
  const rows = await selectAllRows<{ folder_id: string }>(
    (from, to) =>
      db
        .from("folder_decks")
        // Beide Seiten müssen dem Aufrufer gehören: `folders!inner` sperrt
        // fremde Ordner aus, `decks!inner` fremde und weich gelöschte Decks —
        // sonst zählte die Kachel Decks mit, die auf der Ordnerseite gar nicht
        // erscheinen (Liveness-Regel aus #495).
        .select("folder_id, folders!inner(user_id), decks!inner(user_id, deleted_at)")
        .eq("folders.user_id", userId)
        .eq("decks.user_id", userId)
        .is("decks.deleted_at", null)
        // Blättern braucht eine eindeutige Sortierung, sonst dürfen sich Seiten
        // überlappen oder Zeilen auslassen. (folder_id, deck_id) ist der
        // Primärschlüssel der Tabelle und damit eindeutig.
        .order("folder_id", { ascending: true })
        .order("deck_id", { ascending: true })
        .range(from, to),
    "countDecksByFolder"
  );
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.folder_id] = (counts[row.folder_id] ?? 0) + 1;
  return counts;
}

/**
 * Alle Karten der Decks eines Ordners in einem Rutsch (#612).
 *
 * „Alle Karten lernen" holte im Web die Karten Deck für Deck — bei einem
 * Ordner mit 20 Decks 20 Anfragen, die der Browser zum Teil in die Warteschlange
 * stellt. Der Server kann dasselbe mit einer Abfrage über alle Deck-IDs.
 *
 * Rückgabe null = Ordner gehört dem Aufrufer nicht (Route → 404); ein leeres
 * Array heißt: Ordner ist da, aber keine Karte drin.
 *
 * Die Reihenfolge bleibt die alte: Decks in ihrer Ordner-Reihenfolge (#437),
 * darin die Karten nach created_at/id — so lernt sich der Ordner nach der
 * Umstellung genauso durch wie vorher.
 */
export async function listCardsInFolder(
  folderId: string,
  userId: string
): Promise<CardRecord[] | null> {
  const folder = await getFolder(folderId, userId);
  if (!folder) return null;
  const db = getDb();

  // Nur die IDs der Decks im Ordner — ohne Kartenzähler, den braucht hier niemand.
  const { data: links, error: linkError } = await db
    .from("folder_decks")
    .select("deck_id, position, added_at, decks!inner(user_id, deleted_at)")
    .eq("folder_id", folderId)
    .eq("decks.user_id", userId)
    .is("decks.deleted_at", null)
    .order("position", { ascending: true, nullsFirst: false })
    .order("added_at", { ascending: true });
  if (linkError) throw new Error(`listCardsInFolder (Decks): ${linkError.message}`);

  const deckIds = (links ?? []).map((r) => r.deck_id as string);
  if (deckIds.length === 0) return [];
  // Rang je Deck, um die Ordner-Reihenfolge nach dem Laden wiederherzustellen.
  const rank = new Map(deckIds.map((id, i) => [id, i] as const));

  const rows = await selectAllRows<Record<string, unknown>>(
    (from, to) =>
      db
        .from("cards")
        .select()
        .eq("user_id", userId)
        .in("deck_id", deckIds)
        .is("deleted_at", null)
        // Gleiche Sortierung wie listCardsForDeck: created_at allein ist bei
        // Scan-/Import-Karten nicht eindeutig (ein Batch-Insert), id macht das
        // Blättern lückenlos.
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    "listCardsInFolder"
  );

  const cards = rows.map(mapCardRow);
  // Stabil nach Deck-Rang sortieren: innerhalb eines Decks bleibt die
  // created_at/id-Ordnung von oben erhalten.
  return cards.sort(
    (a, b) => (rank.get(a.deckId) ?? 0) - (rank.get(b.deckId) ?? 0)
  );
}

/**
 * Schreibt die Reihenfolge der Decks eines Ordners neu (#437).
 *
 * `deckIds` ist die vollständige gewünschte Reihenfolge. Decks, die im Ordner
 * liegen, aber nicht in der Liste stehen, bleiben unangetastet und rutschen
 * durch `nulls last` bzw. ihre alte Zahl an ihre Stelle — die Funktion kann
 * also nichts aus dem Ordner werfen, sie kann nur umsortieren.
 *
 * Rückgabe false = Ordner gehört dem Aufrufer nicht (Route antwortet 404).
 */
export async function setFolderDeckOrder(
  folderId: string,
  userId: string,
  deckIds: string[]
): Promise<boolean> {
  const folder = await getFolder(folderId, userId);
  if (!folder) return false;
  const db = getDb();
  // Nacheinander statt in einem Rutsch: ein `upsert` würde Zeilen ANLEGEN, wenn
  // eine übergebene deck_id gar nicht in diesem Ordner liegt — damit könnte man
  // über die Sortier-Route fremde Decks einhängen. Ein `update` mit beiden
  // Schlüsseln trifft nur, was schon da ist.
  for (let i = 0; i < deckIds.length; i += 1) {
    const { error } = await db
      .from("folder_decks")
      .update({ position: i })
      .eq("folder_id", folderId)
      .eq("deck_id", deckIds[i]);
    if (error) throw new Error(`setFolderDeckOrder: ${error.message}`);
  }
  return true;
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

/**
 * Clears a deck's share token, killing any previously shared link (#519).
 * Scoped by user_id + deleted_at so only the owner can revoke, and a
 * non-existent/foreign deck matches nothing. Idempotent: a deck that
 * already has no token still returns its row.
 */
export async function clearDeckShareToken(deckId: string, userId: string): Promise<DeckRecord | null> {
  const db = getDb();
  const { data, error } = await db
    .from("decks")
    .update({ share_token: null, updated_at: new Date().toISOString() })
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

// ─── Geteilte Decks nachziehen (#614) ────────────────────────────────────────

/**
 * Eigene, lebende Kopien eines geteilten Decks — erkannt an `source_deck_id`.
 *
 * Die Spalte wird von `duplicateDeck` seit immer geschrieben und war bis hier
 * nie gelesen worden. Genau deshalb entstand bei einem zweiten Klick auf
 * denselben Link still eine ZWEITE Kopie, ohne Hinweis.
 *
 * Neueste zuerst: Gibt es doch mehrere Kopien (etwa aus der Zeit vor diesem
 * Abgleich), ist die jüngste die, mit der gerade gelernt wird.
 */
export async function findDeckCopiesOfSource(
  userId: string,
  sourceDeckId: string
): Promise<DeckRecord[]> {
  const db = getDb();
  const { data, error } = await db
    .from("decks")
    .select()
    .eq("user_id", userId)
    .eq("source_deck_id", sourceDeckId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`findDeckCopiesOfSource: ${error.message}`);
  return (data ?? []).map((row) => mapDeckRow(row));
}

/**
 * Vorder- und Rückseiten ALLER Karten eines Decks — auch der weich gelöschten.
 *
 * Für den Abgleich ist genau das der Punkt: Eine Karte, die die Nutzerin
 * absichtlich weggeworfen hat, darf beim Nachziehen nicht wiederkommen (Laras
 * Regel zu Fall 8). `listCardsForDeck` blendet Gelöschtes aus und wäre hier
 * also falsch — der Abgleich hielte die Karte für „fehlt noch".
 */
export async function listCardTextsIncludingDeleted(
  userId: string,
  deckId: string
): Promise<Array<{ front: string; back: string }>> {
  const db = getDb();
  const rows = await selectAllRows<{ front: string | null; back: string | null }>(
    (from, to) =>
      db
        .from("cards")
        .select("front, back")
        .eq("user_id", userId)
        .eq("deck_id", deckId)
        .order("id", { ascending: true })
        .range(from, to),
    "listCardTextsIncludingDeleted"
  );
  return rows.map((row) => ({ front: row.front ?? "", back: row.back ?? "" }));
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
    // softDeleteDeck marks the deck first and its cards second. If that second
    // write fails, the deck is already gone but its cards are still live rows.
    // Count through live decks as the same safety net used by due/search reads,
    // so an invisible deck can never keep consuming plan capacity (#495).
    //
    // ARCHIVIERTE Decks zählen hier bewusst MIT (#614): ihre Karten sind nicht
    // gelöscht, nur ausgeblendet. Würden sie nicht zählen, wäre Archivieren ein
    // Weg um die Karten-Grenze herum.
    .select("*, decks!inner(deleted_at)", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null)
    .is("decks.deleted_at", null);
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
 * Live cards of ONE deck, regardless of who owns it (#611).
 *
 * Deliberately without a `user_id` filter — unlike every other card read in
 * this module. The shared-deck import copies a deck that belongs to SOMEBODY
 * ELSE, so an ownership filter would always count 0 there and the limit check
 * built on top would silently pass. Authorization happens before the call:
 * `duplicateDeckForUser` resolves the deck through `getDeck(deckId, userId)`,
 * `importSharedDeck` through the share token. `duplicateDeck` reads the cards
 * it copies the same way, for the same reason.
 *
 * The filter mirrors that copy query exactly (`deck_id` + live cards), so what
 * is counted here is precisely what would be written — including
 * image-occlusion cards, which is what `assertCardLimit` counts on the manual
 * path too.
 */
export async function countCardsInDeck(deckId: string): Promise<number> {
  const db = getDb();
  const { count, error } = await db
    .from("cards")
    .select("*", { count: "exact", head: true })
    .eq("deck_id", deckId)
    .is("deleted_at", null);
  if (error) throw new Error(`countCardsInDeck: ${error.message}`);
  return count ?? 0;
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
/**
 * Wie viele IDs eine `in(...)`-Liste pro Anfrage tragen darf.
 *
 * PostgREST setzt die Liste in den Query-String; eine UUID kostet dort rund 39
 * Zeichen, und über etwa 8 kB reißt die URL-Grenze. Bis zur Mehrfachauswahl
 * (#614) kam hier nur die Import-Überzahl an (höchstens 150 Karten), jetzt
 * dürfen es alle Karten eines Pro-Decks sein (2.000). 200 IDs ergeben ~8 kB
 * Liste und lassen genug Luft für den Rest der Adresse.
 */
const IN_LIST_CHUNK = 200;

/**
 * Mehrere Karten eines Decks weich löschen; gibt zurück, wie viele es wirklich
 * getroffen hat (schon Gelöschtes zählt nicht mit — `is deleted_at null`).
 *
 * Stückweise statt in einem Zug: siehe IN_LIST_CHUNK. Bricht ein Stück ab,
 * bleiben die vorherigen gelöscht — der Aufrufer bekommt den Fehler und die
 * Nutzerin sieht nach dem Neuladen, was durchging. Das ist besser als der
 * stille Totalausfall, den eine zu lange Adresse erzeugt hätte.
 */
export async function softDeleteCardsByIds(
  userId: string,
  deckId: string,
  cardIds: string[]
): Promise<number> {
  if (cardIds.length === 0) return 0;
  const db = getDb();
  const now = new Date().toISOString();
  let deleted = 0;
  for (let from = 0; from < cardIds.length; from += IN_LIST_CHUNK) {
    const chunk = cardIds.slice(from, from + IN_LIST_CHUNK);
    const { data, error } = await db
      .from("cards")
      .update({ deleted_at: now })
      .eq("user_id", userId)
      .eq("deck_id", deckId)
      .in("id", chunk)
      .is("deleted_at", null)
      .select("id");
    if (error) throw new Error(`softDeleteCardsByIds: ${error.message}`);
    deleted += (data ?? []).length;
  }
  return deleted;
}

export async function getDeckWithCardCount(
  deckId: string,
  userId: string
): Promise<(DeckRecord & { cardCount: number; imageCardCount: number }) | null> {
  const db = getDb();
  const { data: deck, error: deckError } = await db
    .from("decks")
    .select()
    .eq("id", deckId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (deckError || !deck) return null;

  // Gleiche Zähl-Regel wie listDecks (#612): cardCount sind die Text-Karten,
  // Bild-Occlusion-Karten stehen getrennt. Vorher zählte diese Funktion alles
  // in einen Topf — "Details" sagte "30 Karten", während der Deck-Kopf
  // "20 Karten · 10 Bild-Karten" zeigte.
  const [textResult, imageResult] = await Promise.all([
    db
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("deck_id", deckId)
      .neq("card_type", "occlusion")
      .is("deleted_at", null),
    db
      .from("cards")
      .select("*", { count: "exact", head: true })
      .eq("deck_id", deckId)
      .eq("card_type", "occlusion")
      .is("deleted_at", null),
  ]);

  return {
    ...mapDeckRow(deck),
    cardCount: textResult.count ?? 0,
    imageCardCount: imageResult.count ?? 0,
  };
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
        // QUOTE: „X von Y Antworten richtig" in der Deck-Statistik lässt
        // Prüfungen aus, wie die Gesamt-Trefferquote. Die Prüfung misst unter
        // Druck und bekommt ihre eigene Zahl.
        .neq("mode", "test")
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
 *
 * Returns the capped list AND `total` — how many cards have at least one wrong
 * answer. The clients used to show `limit` cards without ever saying that more
 * existed, and the practice button silently inherited that display cap (#682).
 * `total` is free: the full set is grouped in memory before the slice.
 */
export async function getDeckWobblyCards(
  userId: string,
  deckId: string,
  limit = 5
): Promise<{
  cards: Array<{
    cardId: string;
    front: string;
    back: string;
    wrongCount: number;
    lastWrongAt: string;
  }>;
  total: number;
}> {
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

  const ranked = [...byCard.entries()]
    .map(([cardId, s]) => ({ cardId, ...s }))
    .sort(
      (a, b) =>
        b.wrongCount - a.wrongCount || b.lastWrongAt.localeCompare(a.lastWrongAt)
    );

  return { cards: ranked.slice(0, limit), total: ranked.length };
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
        // QUOTE: der Deck-Vergleich (Pro) rankt Decks nach Trefferquote und
        // lässt Prüfungen aus, wie alle „wie gut"-Zahlen.
        .neq("mode", "test")
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

// ─── Prüfungen (test_attempts) ──────────────────────────────────────────────

/**
 * IDs aller nicht gelöschten Karten, die diesem Nutzer in diesem Deck gehören.
 * Grundlage für die Prüfungs-Zählung: nur Antworten zu diesen IDs zählen, damit
 * eine gefälschte oder veraltete cardId den Nenner nicht aufbläht.
 */
export async function getDeckCardIds(userId: string, deckId: string): Promise<Set<string>> {
  const db = getDb();
  const { data, error } = await db
    .from("cards")
    .select("id")
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .is("deleted_at", null);
  if (error) throw new Error(`getDeckCardIds: ${error.message}`);
  return new Set((data ?? []).map((r) => r.id as string));
}

export interface TestAttemptRow {
  id: string;
  deckId: string;
  questionCount: number;
  correctCount: number;
  submittedAt: string;
}

/**
 * Fehlermeldung, an der der Service den Deck-Konflikt erkennt (23505 aus dem
 * ON-CONFLICT-WHERE der Funktion: gleicher Rundenschlüssel, anderes Deck).
 * Eigene Konstante, damit Werfer und Fänger denselben String benutzen —
 * message-basierte Erkennung ist hier bereits Konvention (vgl. "Card not
 * found" in http.ts).
 */
export const TEST_ATTEMPT_DECK_CONFLICT = "test_attempt_deck_conflict";

/**
 * Schreibt (oder korrigiert per „War doch richtig") eine abgegebene Prüfung
 * über record_test_attempt. Zählen und Filtern der Antworten passiert im
 * Service; hier nur der atomare, idempotente Upsert.
 */
export async function recordTestAttempt(
  userId: string,
  deckId: string,
  idempotencyKey: string,
  questionCount: number,
  correctCount: number
): Promise<TestAttemptRow> {
  const db = getDb();
  const { data, error } = await db.rpc("record_test_attempt", {
    p_user: userId,
    p_deck: deckId,
    p_key: idempotencyKey,
    p_questions: questionCount,
    p_correct: correctCount,
  });
  if (error) {
    // 23505 kommt ausschließlich aus dem „gleicher Schlüssel, anderes Deck"-
    // Wächter der Funktion — der Client hat einen Rundenschlüssel wiederverwendet.
    if ((error as { code?: string }).code === "23505") {
      throw new Error(TEST_ATTEMPT_DECK_CONFLICT);
    }
    throw new Error(`recordTestAttempt: ${error.message}`);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("recordTestAttempt: no row returned");
  return {
    id: row.id as string,
    deckId: row.deck_id as string,
    questionCount: row.question_count as number,
    correctCount: row.correct_count as number,
    submittedAt: row.submitted_at as string,
  };
}

/**
 * Die letzten `limit` abgegebenen Prüfungen dieser Nutzerin, neueste zuerst,
 * mit Deck-Titel. Prüfungen zu WEICH gelöschten Decks fallen raus (inner join +
 * `decks.deleted_at is null`): Laras Regel „Deck gelöscht -> Prüfungen weg".
 * Der FK-Cascade allein trägt das nicht, weil softDeleteDeck nur deleted_at
 * setzt und die Kaskade deshalb nie feuert. Der Filter läuft VOR dem limit, es
 * kommen also die letzten fünf mit noch lebendem Deck.
 */
export async function getLastTestAttempts(
  userId: string,
  limit = 5
): Promise<TestAttemptSummary[]> {
  const db = getDb();
  const { data, error } = await db
    .from("test_attempts")
    .select("id, deck_id, question_count, correct_count, submitted_at, decks!inner(title, deleted_at)")
    .eq("user_id", userId)
    .is("decks.deleted_at", null)
    .order("submitted_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getLastTestAttempts: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id as string,
    deckId: r.deck_id as string,
    deckTitle: (r.decks?.title as string | null) ?? "",
    questionCount: r.question_count as number,
    correctCount: r.correct_count as number,
    submittedAt: r.submitted_at as string,
  }));
}

// ─── Lernstand (geräteübergreifendes „Weitermachen", #610) ──────────────────

/** Lernarten mit merkbarer Position — deckungsgleich mit dem CHECK der Tabelle. */
export type SessionProgressMode = "flashcards" | "cloze";

export interface SessionProgressRecord {
  index: number;
  cardId: string;
  source: string;
  reverse: boolean;
  total: number;
  results?: Record<string, { correct: boolean; overridden: boolean }>;
  updatedAt: string;
}

/**
 * Gemerkte Position einer unterbrochenen Runde — oder null.
 *
 * Immer nach user_id gefiltert: Der Admin-Client umgeht RLS, die Zugehörigkeit
 * muss also hier im Code stehen (Deck-Ownership-Pattern).
 */
export async function getSessionProgress(
  userId: string,
  deckId: string,
  mode: SessionProgressMode
): Promise<SessionProgressRecord | null> {
  const db = getDb();
  const { data, error } = await db
    .from("session_progress")
    .select("card_index, card_id, source, reverse, total, results, updated_at")
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .eq("mode", mode)
    .maybeSingle();
  if (error || !data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;
  return {
    index: row.card_index as number,
    cardId: row.card_id as string,
    source: row.source as string,
    reverse: row.reverse === true,
    total: row.total as number,
    ...(row.results ? { results: row.results } : {}),
    updatedAt: row.updated_at as string,
  };
}

/**
 * Position speichern (eine Zeile je Nutzer/Deck/Lernart, wird überschrieben).
 *
 * Das Deck muss dem Nutzer gehören und leben — sonst legte ein manipulierter
 * Aufruf Zeilen zu fremden Decks an. Liefert false, wenn das Deck nicht passt.
 */
export async function saveSessionProgress(
  userId: string,
  deckId: string,
  mode: SessionProgressMode,
  progress: Omit<SessionProgressRecord, "updatedAt">
): Promise<boolean> {
  const deck = await getDeck(deckId, userId);
  if (!deck) return false;
  const db = getDb();
  const { error } = await db.from("session_progress").upsert(
    {
      user_id: userId,
      deck_id: deckId,
      mode,
      card_index: progress.index,
      card_id: progress.cardId,
      source: progress.source,
      reverse: progress.reverse,
      total: progress.total,
      results: progress.results ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,deck_id,mode" }
  );
  if (error) throw new Error(`saveSessionProgress: ${error.message}`);
  return true;
}

/** Merker löschen — am Rundenende, damit eine fertige Runde nichts anbietet. */
export async function clearSessionProgress(
  userId: string,
  deckId: string,
  mode: SessionProgressMode
): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from("session_progress")
    .delete()
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .eq("mode", mode);
  if (error) throw new Error(`clearSessionProgress: ${error.message}`);
}

// ─── Papierkorb (#614) ───────────────────────────────────────────────────────
//
// Gelöschtes trug schon immer nur `deleted_at` und wird von allen Lesern
// ausgeblendet — es fehlte allein der Weg zurück. Laras Entscheidung: NICHTS
// verschwindet von allein (kein Purge-Cron), geleert wird von Hand.
//
// Der Schlüssel zum Deck-Restore ist der Zeitstempel: softDeleteDeck stempelt
// das Deck und seine damals noch lebenden Karten mit DEMSELBEN `now`, und nur
// diese Karten dürfen mit dem Deck zurückkommen. Eine Karte, die vorher einzeln
// weggeworfen wurde, trägt einen älteren Stempel und bleibt gelöscht — genau so
// gewollt (Laras Regel „selbst Gelöschtes kommt nicht zurück").

export interface TrashDeckEntry {
  id: string;
  title: string;
  cardCount: number;
  deletedAt: string;
}

export interface TrashCardEntry {
  id: string;
  front: string;
  back: string;
  deckId: string;
  deckTitle: string;
  deletedAt: string;
}

/**
 * Inhalt des Papierkorbs: gelöschte Decks und einzeln gelöschte Karten.
 *
 * Die Kartenliste zeigt NUR Karten in lebenden Decks (`decks!inner` +
 * `decks.deleted_at is null`). Karten eines gelöschten Decks hängen an dessen
 * Eintrag und kommen mit ihm zurück; einzeln aufgeführt wären sie doppelt
 * sichtbar und ihr „Zurückholen" müsste am fehlenden Deck scheitern.
 */
export async function listTrash(
  userId: string
): Promise<{ decks: TrashDeckEntry[]; cards: TrashCardEntry[] }> {
  const db = getDb();

  // Seitenweise (#612): 135 gelöschte Decks in einem echten Konto sind belegt,
  // und PostgREST liefert höchstens 1000 Zeilen, ohne das zu sagen.
  const deckRows = await selectAllRows<Record<string, unknown>>(
    (from, to) =>
      db
        .from("decks")
        .select("id, title, deleted_at")
        .eq("user_id", userId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    "listTrash decks"
  );

  // Der angezeigte Kartenzähler muss dieselbe Bedingung tragen wie restoreDeck
  // (#702): restoreDeck holt nur Karten zurück, deren deleted_at EXAKT dem des
  // Decks entspricht (softDeleteDeck stempelt Deck und die dann noch lebenden
  // Karten gemeinsam; individuell VORHER gelöschte Karten tragen einen älteren
  // Stempel und bleiben liegen — Laras Regel „selbst Gelöschtes kommt nicht
  // zurück", siehe Kommentar oben). Ein ungefilterter `cards(count)` zählte
  // früher auch diese liegen gebliebenen Karten mit, sodass „Deck · 50 Karten"
  // anzeigte, obwohl restoreDeck nur 45 zurückholte.
  const deletedAtByDeck = new Map(
    (deckRows as Array<{ id: string; deleted_at: string }>).map((row) => [row.id, row.deleted_at])
  );
  const deckIds = [...deletedAtByDeck.keys()];
  const cardCountByDeck = new Map<string, number>();
  if (deckIds.length > 0) {
    const deckCardStamps = await selectAllRows<{ deck_id: string; deleted_at: string | null }>(
      (from, to) =>
        db
          .from("cards")
          .select("deck_id, deleted_at")
          .eq("user_id", userId)
          .in("deck_id", deckIds)
          .not("deleted_at", "is", null)
          // Stabile Sortierung übers Blättern hinweg (siehe selectAllRows) —
          // `id` ist eindeutig, auch wenn es nicht in der Projektion steht.
          .order("id", { ascending: true })
          .range(from, to),
      "listTrash deck card counts"
    );
    for (const row of deckCardStamps) {
      if (row.deleted_at !== null && row.deleted_at === deletedAtByDeck.get(row.deck_id)) {
        cardCountByDeck.set(row.deck_id, (cardCountByDeck.get(row.deck_id) ?? 0) + 1);
      }
    }
  }

  const cardRows = await selectAllRows<Record<string, unknown>>(
    (from, to) =>
      db
        .from("cards")
        .select("id, front, back, deck_id, deleted_at, decks!inner(title, deleted_at)")
        .eq("user_id", userId)
        .not("deleted_at", "is", null)
        .is("decks.deleted_at", null)
        .order("deleted_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    "listTrash cards"
  );

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    decks: (deckRows as any[]).map((row) => ({
      id: row.id as string,
      title: (row.title as string) ?? "",
      cardCount: cardCountByDeck.get(row.id as string) ?? 0,
      deletedAt: row.deleted_at as string,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cards: (cardRows as any[]).map((row) => ({
      id: row.id as string,
      front: (row.front as string) ?? "",
      back: (row.back as string) ?? "",
      deckId: row.deck_id as string,
      deckTitle: (row.decks?.title as string) ?? "",
      deletedAt: row.deleted_at as string,
    })),
  };
}

/** Ein gelöschtes Deck — Grundlage für Limit-Prüfung und Restore. */
export async function getDeletedDeck(
  deckId: string,
  userId: string
): Promise<{ id: string; title: string; deletedAt: string } | null> {
  const db = getDb();
  const { data, error } = await db
    .from("decks")
    .select("id, title, deleted_at")
    .eq("id", deckId)
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, title: data.title, deletedAt: data.deleted_at };
}

/**
 * Deck zurückholen, samt der Karten, die MIT ihm gelöscht wurden.
 *
 * Reihenfolge Karten -> Deck, genau umgekehrt zu softDeleteDeck: bricht der
 * zweite Schritt ab, hängen lebende Karten unter einem noch gelöschten Deck.
 * Alle gehärteten Leser joinen auf lebende Decks (#495), diese Karten bleiben
 * also unsichtbar statt in einem sichtbar leeren Deck zu fehlen — und ein
 * zweiter Versuch heilt es vollständig.
 */
export async function restoreDeck(deckId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const deck = await getDeletedDeck(deckId, userId);
  if (!deck) return false;

  const { error: cardsError } = await db
    .from("cards")
    .update({ deleted_at: null })
    .eq("deck_id", deckId)
    .eq("user_id", userId)
    .eq("deleted_at", deck.deletedAt);
  if (cardsError) throw new Error(`restoreDeck cards: ${cardsError.message}`);

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("decks")
    .update({ deleted_at: null, updated_at: now })
    .eq("id", deckId)
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`restoreDeck: ${error.message}`);
  return !!data;
}

/** Eine einzeln gelöschte Karte samt Zustand ihres Decks. */
export async function getDeletedCard(
  cardId: string,
  userId: string
): Promise<{ id: string; deckId: string; deckDeleted: boolean } | null> {
  const db = getDb();
  const { data, error } = await db
    .from("cards")
    .select("id, deck_id, decks!inner(deleted_at)")
    .eq("id", cardId)
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .maybeSingle();
  if (error || !data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deckDeletedAt = (data as any).decks?.deleted_at ?? null;
  return { id: data.id, deckId: data.deck_id, deckDeleted: !!deckDeletedAt };
}

/** Einzelne Karte zurückholen. Ihr Deck muss leben — sonst bliebe sie unsichtbar. */
export async function restoreCard(cardId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const { data, error } = await db
    .from("cards")
    .update({ deleted_at: null })
    .eq("id", cardId)
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`restoreCard: ${error.message}`);
  return !!data;
}

/**
 * Endgültig löschen — echtes DELETE, nicht noch ein Stempel.
 *
 * `.not("deleted_at", "is", null)` ist die Sicherung: was live ist, kann über
 * diesen Weg nie verschwinden, welche ID auch hereinkommt. Am Deck hängen die
 * Karten per `on delete cascade`, an den Karten die `review_logs` — die
 * Antworten zu diesen Karten fallen damit aus der Statistik. Das ist der Preis
 * von „endgültig" und steht genau so im Bestätigungsdialog.
 */
export async function purgeTrashDeck(deckId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const { data, error } = await db
    .from("decks")
    .delete()
    .eq("id", deckId)
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`purgeTrashDeck: ${error.message}`);
  return !!data;
}

export async function purgeTrashCard(cardId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const { data, error } = await db
    .from("cards")
    .delete()
    .eq("id", cardId)
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`purgeTrashCard: ${error.message}`);
  return !!data;
}

/**
 * Papierkorb leeren. Karten zuerst, dann Decks: die Karten eines gelöschten
 * Decks fallen über den Cascade ohnehin, aber einzeln gelöschte Karten in
 * LEBENDEN Decks erwischt nur der erste Schritt.
 */
export async function purgeAllTrash(
  userId: string
): Promise<{ decks: number; cards: number }> {
  const db = getDb();
  const { data: cardData, error: cardError } = await db
    .from("cards")
    .delete()
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .select("id");
  if (cardError) throw new Error(`purgeAllTrash cards: ${cardError.message}`);

  const { data: deckData, error: deckError } = await db
    .from("decks")
    .delete()
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .select("id");
  if (deckError) throw new Error(`purgeAllTrash decks: ${deckError.message}`);

  return { decks: (deckData ?? []).length, cards: (cardData ?? []).length };
}
