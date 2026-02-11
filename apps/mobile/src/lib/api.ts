// API client for communicating with the clearn backend
import { supabase } from "./supabase";

const API_BASE = "https://clearn-api.vercel.app";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  } catch {
    // Continue without auth header
  }

  return headers;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const authHeaders = await getAuthHeaders();

  const res = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `API error ${res.status}`);
  }

  return res.json();
}

// --- Types ---

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
}

export interface Deck {
  id: string;
  userId: string;
  title: string;
  tags: string[];
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

// --- API Methods ---

export async function scanText(
  userId: string,
  text: string,
  language = "de"
): Promise<ScanResponse> {
  const idempotencyKey = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return request<ScanResponse>("/api/v1/scan/process", {
    method: "POST",
    body: JSON.stringify({
      userId,
      extractedText: text,
      idempotencyKey,
      sourceLanguage: language,
    }),
  });
}

export async function scanImage(
  userId: string,
  imageBase64: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
  language = "de"
): Promise<ScanResponse> {
  const idempotencyKey = `scan-img-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return request<ScanResponse>("/api/v1/scan/process", {
    method: "POST",
    body: JSON.stringify({
      userId,
      imageBase64,
      imageMimeType: mimeType,
      idempotencyKey,
      sourceLanguage: language,
    }),
  });
}

export async function createDeck(
  userId: string,
  title: string,
  tags: string[] = []
): Promise<{ deck: Deck }> {
  return request<{ deck: Deck }>("/api/v1/decks", {
    method: "POST",
    body: JSON.stringify({ userId, title, tags }),
  });
}

export async function listDecks(
  userId: string
): Promise<{ decks: Deck[] }> {
  return request<{ decks: Deck[] }>(`/api/v1/decks?userId=${userId}`);
}

export async function createCard(
  userId: string,
  deckId: string,
  card: { front: string; back: string; type: string; difficulty: string; tags: string[] }
): Promise<{ card: Card }> {
  return request<{ card: Card }>("/api/v1/cards", {
    method: "POST",
    body: JSON.stringify({ userId, deckId, card }),
  });
}

export async function getDueCards(
  userId: string
): Promise<{ cards: Card[] }> {
  return request<{ cards: Card[] }>(`/api/v1/learn/due?userId=${userId}`);
}

export async function reviewCard(
  userId: string,
  cardId: string,
  rating: "again" | "hard" | "good" | "easy"
): Promise<ReviewResponse> {
  const idempotencyKey = `review-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return request<ReviewResponse>(`/api/v1/cards/${cardId}/review`, {
    method: "POST",
    body: JSON.stringify({
      userId,
      cardId,
      rating,
      reviewedAt: new Date().toISOString(),
      idempotencyKey,
    }),
  });
}

// --- Deck Management ---

export async function updateDeck(
  deckId: string,
  updates: { title?: string; tags?: string[] }
): Promise<{ deck: Deck }> {
  return request<{ deck: Deck }>(`/api/v1/decks/${deckId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteDeck(deckId: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/v1/decks/${deckId}`, {
    method: "DELETE",
  });
}

export async function listCardsInDeck(
  deckId: string
): Promise<{ cards: Card[] }> {
  return request<{ cards: Card[] }>(`/api/v1/decks/${deckId}/cards`);
}

// --- Card Management ---

export async function updateCard(
  cardId: string,
  updates: { front?: string; back?: string; type?: string; difficulty?: string; tags?: string[]; starred?: boolean }
): Promise<{ card: Card }> {
  return request<{ card: Card }>(`/api/v1/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteCard(cardId: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/v1/cards/${cardId}`, {
    method: "DELETE",
  });
}

// --- Subscription ---

export async function getSubscriptionStatus(
  userId: string
): Promise<{ status: { tier: string; isActive: boolean } }> {
  return request<{ status: { tier: string; isActive: boolean } }>(
    `/api/v1/subscription/status?userId=${userId}`
  );
}

// --- Stats ---

export async function getStats(): Promise<{ stats: StatsResponse }> {
  return request<{ stats: StatsResponse }>("/api/v1/stats");
}
