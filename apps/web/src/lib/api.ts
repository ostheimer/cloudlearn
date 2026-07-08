import { getSupabase } from "./supabase-browser";

/**
 * Web API client for the clearn backend. A focused port of the mobile
 * client (apps/mobile/src/lib/api.ts): same endpoints, same Bearer-JWT auth,
 * same response shapes — so the web app reuses the proven contract.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_CLEARN_API_BASE_URL ?? "https://clearn-api.vercel.app";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    if (code) this.code = code;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const {
      data: { session },
    } = await getSupabase().auth.getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  } catch {
    // Continue without auth header — request() will throw if auth was required.
  }
  return headers;
}

async function request<T>(
  path: string,
  options?: RequestInit,
  config?: { requiresAuth?: boolean }
): Promise<T> {
  const authHeaders = await getAuthHeaders();
  if (config?.requiresAuth && !authHeaders.Authorization) {
    throw new ApiError("Authentication required", 401, "UNAUTHORIZED_CLIENT");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders, ...options?.headers },
  });

  const body = (await res.json().catch(() => null)) as
    | { message?: string; code?: string }
    | T
    | null;

  if (!res.ok) {
    const code = (body as { code?: string } | null)?.code;
    throw new ApiError(
      (body as { message?: string } | null)?.message ?? `API-Fehler ${res.status}`,
      res.status,
      code
    );
  }

  if (body === null) throw new ApiError("Leere API-Antwort", res.status);
  return body as T;
}

function authed<T>(path: string, options?: RequestInit): Promise<T> {
  return request<T>(path, options, { requiresAuth: true });
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Deck {
  id: string;
  userId: string;
  title: string;
  tags: string[];
  cardCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Card {
  id: string;
  userId: string;
  deckId: string;
  front: string;
  back: string;
  type: string;
  difficulty: string;
  tags: string[];
  starred: boolean;
  fsrsDue: string;
  fsrsState: string;
}

export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface ReviewResponse {
  requestId: string;
  cardId: string;
  nextDueAt: string;
  stability: number;
  difficulty: number;
  state: string;
}

export interface StatsResponse {
  totalDecks: number;
  dueCards: number;
  currentStreak: number;
  longestStreak: number;
  lastReviewDate: string | null;
  dailyGoal: number;
  reviewsToday: number;
  reviewsThisWeek: number;
  reviewsTotal: number;
  accuracyRate: number;
  reviewsByDay: Array<{ date: string; count: number }>;
}

// ─── Decks ──────────────────────────────────────────────────────────────────

export function listDecks(userId: string): Promise<{ decks: Deck[] }> {
  return authed<{ decks: Deck[] }>(`/api/v1/decks?userId=${encodeURIComponent(userId)}`);
}

export function createDeck(
  userId: string,
  title: string,
  tags: string[] = []
): Promise<{ deck: Deck }> {
  return authed<{ deck: Deck }>("/api/v1/decks", {
    method: "POST",
    body: JSON.stringify({ userId, title, tags }),
  });
}

export function updateDeck(
  deckId: string,
  updates: { title?: string; tags?: string[] }
): Promise<{ deck: Deck }> {
  return authed<{ deck: Deck }>(`/api/v1/decks/${deckId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteDeck(deckId: string): Promise<{ deleted: boolean }> {
  return authed<{ deleted: boolean }>(`/api/v1/decks/${deckId}`, { method: "DELETE" });
}

export function duplicateDeck(deckId: string): Promise<{ deck: Deck }> {
  return authed<{ deck: Deck }>(`/api/v1/decks/${deckId}/duplicate`, { method: "POST" });
}

export function shareDeck(
  deckId: string
): Promise<{ shareToken: string; shareUrl: string }> {
  return authed<{ shareToken: string; shareUrl: string }>(`/api/v1/decks/${deckId}/share`, {
    method: "POST",
  });
}

export interface DeckDetails {
  id: string;
  title: string;
  tags: string[];
  cardCount: number;
}

export function getDeckDetails(deckId: string): Promise<{ details: DeckDetails }> {
  return authed<{ details: DeckDetails }>(`/api/v1/decks/${deckId}/details`);
}

// ─── Cards ──────────────────────────────────────────────────────────────────

export function listCardsInDeck(deckId: string): Promise<{ cards: Card[] }> {
  return authed<{ cards: Card[] }>(`/api/v1/decks/${deckId}/cards`);
}

export function createCard(
  userId: string,
  deckId: string,
  card: {
    front: string;
    back: string;
    type?: string;
    difficulty?: string;
    tags?: string[];
  }
): Promise<{ card: Card }> {
  return authed<{ card: Card }>("/api/v1/cards", {
    method: "POST",
    body: JSON.stringify({
      userId,
      deckId,
      card: {
        front: card.front,
        back: card.back,
        // API card types: basic | cloze | mcq | matching (see cardService flashcardSchema)
        type: card.type ?? "basic",
        difficulty: card.difficulty ?? "medium",
        tags: card.tags ?? [],
      },
    }),
  });
}

export function updateCard(
  cardId: string,
  updates: {
    front?: string;
    back?: string;
    type?: string;
    difficulty?: string;
    tags?: string[];
    starred?: boolean;
  }
): Promise<{ card: Card }> {
  return authed<{ card: Card }>(`/api/v1/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteCard(cardId: string): Promise<{ deleted: boolean }> {
  return authed<{ deleted: boolean }>(`/api/v1/cards/${cardId}`, { method: "DELETE" });
}

// ─── Learn / Review ───────────────────────────────────────────────────────────

export function getDueCards(userId: string): Promise<{ cards: Card[] }> {
  return authed<{ cards: Card[] }>(`/api/v1/learn/due?userId=${encodeURIComponent(userId)}`);
}

export function reviewCard(
  userId: string,
  cardId: string,
  rating: ReviewRating,
  options?: { reviewedAt?: string; reviewDurationMs?: number }
): Promise<ReviewResponse> {
  const reviewedAt = options?.reviewedAt ?? new Date().toISOString();
  const idempotencyKey = `review-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const body: {
    userId: string;
    cardId: string;
    rating: ReviewRating;
    reviewedAt: string;
    idempotencyKey: string;
    reviewDurationMs?: number;
  } = { userId, cardId, rating, reviewedAt, idempotencyKey };
  if (options?.reviewDurationMs !== undefined) {
    body.reviewDurationMs = options.reviewDurationMs;
  }
  return authed<ReviewResponse>(`/api/v1/cards/${cardId}/review`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export function getStats(): Promise<{ stats: StatsResponse }> {
  return authed<{ stats: StatsResponse }>("/api/v1/stats");
}

// ─── KI-Import (Karten aus Text/URL erzeugen) ────────────────────────────────
// Diese Endpunkte erzeugen die Karten UND legen serverseitig ein neues Deck an
// (kein separater Speichern-Schritt). Die Antwort enthält keine deckId — der
// Aufrufer findet das neue Deck über die aktualisierte Deckliste.

export interface Flashcard {
  front: string;
  back: string;
  type: string;
  difficulty: string;
  tags: string[];
}

export interface ScanResponse {
  requestId: string;
  model: string;
  fallbackUsed: boolean;
  cards: Flashcard[];
  deckTitle?: string;
  usage?: { lpSpent: number; lpBalance: number };
}

export interface UrlImportResponse extends ScanResponse {
  sourceUrl: string;
  imagesUsed: number;
}

export interface AiUsageResponse {
  tier: "free" | "pro" | "lifetime";
  lpBalance: number;
  lpCostAiScan: number;
  lpCostUrlImport: number;
  lpCostPdfImport: number;
}

function importIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Erzeugt per KI Flashcards aus reinem Text. Legt serverseitig ein neues Deck an. */
export function scanText(
  userId: string,
  text: string,
  language = "de"
): Promise<ScanResponse> {
  return authed<ScanResponse>("/api/v1/scan/process", {
    method: "POST",
    body: JSON.stringify({
      userId,
      extractedText: text,
      idempotencyKey: importIdempotencyKey("scan"),
      sourceLanguage: language,
    }),
  });
}

/** Erzeugt per KI Flashcards aus einer Webseiten-URL. Legt serverseitig ein neues Deck an. */
export function importFromUrl(
  userId: string,
  sourceUrl: string,
  maxImages = 4,
  language = "de"
): Promise<UrlImportResponse> {
  return authed<UrlImportResponse>("/api/v1/import/url", {
    method: "POST",
    body: JSON.stringify({
      userId,
      sourceUrl,
      maxImages,
      idempotencyKey: importIdempotencyKey("import-url"),
      sourceLanguage: language,
    }),
  });
}

/** Aktueller Lernpunkte-Stand + Kosten pro KI-Aktion. */
export function getLpBalance(): Promise<AiUsageResponse> {
  return authed<AiUsageResponse>("/api/v1/usage");
}
