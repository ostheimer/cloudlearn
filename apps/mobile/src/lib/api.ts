// API client for communicating with the clearn backend
import { supabase } from "./supabase";

const API_BASE = "https://clearn-api.vercel.app";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    if (code) {
      this.code = code;
    }
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

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

  const body = (await res.json().catch(() => null)) as
    | { message?: string; code?: string }
    | T
    | null;

  if (!res.ok) {
    throw new ApiError(
      (body as { message?: string } | null)?.message ?? `API error ${res.status}`,
      res.status,
      (body as { code?: string } | null)?.code
    );
  }

  if (body === null) {
    throw new ApiError("Empty API response", res.status);
  }

  return body as T;
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

export interface SubscriptionStatus {
  userId: string;
  tier: "free" | "pro" | "lifetime";
  isActive: boolean;
  expiresAt: string | null;
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
  _userId?: string
): Promise<{ status: SubscriptionStatus }> {
  return request<{ status: SubscriptionStatus }>("/api/v1/subscription/status");
}

// --- Stats ---

export async function getStats(): Promise<{ stats: StatsResponse }> {
  return request<{ stats: StatsResponse }>("/api/v1/stats");
}

// --- Courses ---

export interface Course {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listCourses(): Promise<{ courses: Course[] }> {
  return request<{ courses: Course[] }>("/api/v1/courses");
}

export async function getCourse(courseId: string): Promise<{ course: Course }> {
  return request<{ course: Course }>(`/api/v1/courses/${courseId}`);
}

export async function createCourse(
  title: string,
  description?: string,
  color?: string
): Promise<{ course: Course }> {
  return request<{ course: Course }>("/api/v1/courses", {
    method: "POST",
    body: JSON.stringify({ title, description, color }),
  });
}

export async function updateCourseApi(
  courseId: string,
  updates: { title?: string; description?: string; color?: string }
): Promise<{ course: Course }> {
  return request<{ course: Course }>(`/api/v1/courses/${courseId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteCourseApi(courseId: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/v1/courses/${courseId}`, {
    method: "DELETE",
  });
}

export async function addDeckToCourse(
  courseId: string,
  deckId: string,
  position = 0
): Promise<{ added: boolean }> {
  return request<{ added: boolean }>(`/api/v1/courses/${courseId}/decks`, {
    method: "POST",
    body: JSON.stringify({ deckId, position }),
  });
}

export async function removeDeckFromCourse(
  courseId: string,
  deckId: string
): Promise<{ removed: boolean }> {
  return request<{ removed: boolean }>(`/api/v1/courses/${courseId}/decks?deckId=${deckId}`, {
    method: "DELETE",
  });
}

export async function listDecksInCourse(
  courseId: string
): Promise<{ decks: Deck[] }> {
  return request<{ decks: Deck[] }>(`/api/v1/courses/${courseId}/decks`);
}

// --- Folders ---

export interface Folder {
  id: string;
  userId: string;
  title: string;
  parentId: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listFolders(): Promise<{ folders: Folder[] }> {
  return request<{ folders: Folder[] }>("/api/v1/folders");
}

export async function getFolder(folderId: string): Promise<{ folder: Folder }> {
  return request<{ folder: Folder }>(`/api/v1/folders/${folderId}`);
}

export async function createFolder(
  title: string,
  parentId?: string,
  color?: string
): Promise<{ folder: Folder }> {
  return request<{ folder: Folder }>("/api/v1/folders", {
    method: "POST",
    body: JSON.stringify({ title, parentId, color }),
  });
}

export async function updateFolderApi(
  folderId: string,
  updates: { title?: string; parentId?: string | null; color?: string }
): Promise<{ folder: Folder }> {
  return request<{ folder: Folder }>(`/api/v1/folders/${folderId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteFolderApi(folderId: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/v1/folders/${folderId}`, {
    method: "DELETE",
  });
}

export async function addDeckToFolder(
  folderId: string,
  deckId: string
): Promise<{ added: boolean }> {
  return request<{ added: boolean }>(`/api/v1/folders/${folderId}/decks`, {
    method: "POST",
    body: JSON.stringify({ deckId }),
  });
}

export async function removeDeckFromFolder(
  folderId: string,
  deckId: string
): Promise<{ removed: boolean }> {
  return request<{ removed: boolean }>(`/api/v1/folders/${folderId}/decks?deckId=${deckId}`, {
    method: "DELETE",
  });
}

export async function listDecksInFolder(
  folderId: string
): Promise<{ decks: Deck[] }> {
  return request<{ decks: Deck[] }>(`/api/v1/folders/${folderId}/decks`);
}

// --- Deck Actions (Duplicate, Share, Export, Details) ---

export async function duplicateDeck(deckId: string): Promise<{ deck: Deck }> {
  return request<{ deck: Deck }>(`/api/v1/decks/${deckId}/duplicate`, {
    method: "POST",
  });
}

export async function shareDeck(deckId: string): Promise<{ shareToken: string; shareUrl: string }> {
  return request<{ shareToken: string; shareUrl: string }>(`/api/v1/decks/${deckId}/share`, {
    method: "POST",
  });
}

export async function getSharedDeck(shareToken: string): Promise<{ deck: Deck; cards: Card[] }> {
  return request<{ deck: Deck; cards: Card[] }>(`/api/v1/decks/share/${shareToken}`);
}

export interface DeckDetails {
  id: string;
  userId: string;
  title: string;
  tags: string[];
  cardCount: number;
  courses: Course[];
  folders: Folder[];
  createdAt: string;
  updatedAt: string;
}

export async function getDeckDetails(deckId: string): Promise<{ details: DeckDetails }> {
  return request<{ details: DeckDetails }>(`/api/v1/decks/${deckId}/details`);
}

export async function exportDeckForOffline(
  deckId: string
): Promise<{ deck: Deck; cards: Card[]; exportedAt: string }> {
  return request<{ deck: Deck; cards: Card[]; exportedAt: string }>(`/api/v1/decks/${deckId}/export`);
}
