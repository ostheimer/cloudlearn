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

// Callback registered by the app root to navigate to the paywall when a 402 is returned.
// Decouples the API client from expo-router navigation.
type PaywallTrigger = () => void;
let _paywallTrigger: PaywallTrigger | null = null;

export function registerPaywallTrigger(trigger: PaywallTrigger): void {
  _paywallTrigger = trigger;
}

export function unregisterPaywallTrigger(): void {
  _paywallTrigger = null;
}

export function triggerPaywall(): void {
  _paywallTrigger?.();
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
    const code = (body as { code?: string } | null)?.code;
    // Auto-open paywall when the server signals quota exceeded
    if (res.status === 402 && code === "PAYWALL_REQUIRED") {
      _paywallTrigger?.();
    }
    throw new ApiError(
      (body as { message?: string } | null)?.message ?? `API error ${res.status}`,
      res.status,
      code
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

export interface LpUsageInfo {
  lpSpent: number;
  lpBalance: number;
}

export interface ScanResponse {
  requestId: string;
  model: string;
  fallbackUsed: boolean;
  cards: Flashcard[];
  deckTitle?: string;
  usage?: LpUsageInfo;
}

export interface UrlImportResponse extends ScanResponse {
  sourceUrl: string;
  imagesUsed: number;
  usage?: LpUsageInfo;
}

export interface AiUsageResponse {
  tier: "free" | "pro";
  lpBalance: number;
  lpEarnedToday: number;
  lpAdsToday: number;
  lpEarnCapToday: number;
  lpAdCapToday: number;
  lpCostAiScan: number;
  lpCostUrlImport: number;
  lpCostPdfImport: number;
  periodStart: string | null;
}

export interface LpEarnResponse {
  granted: number;
  newBalance: number;
  capReached: boolean;
}

export interface LpMilestoneResponse {
  granted: number;
  alreadyClaimed: boolean;
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

export async function importFromUrl(
  userId: string,
  sourceUrl: string,
  maxImages = 4,
  language = "de"
): Promise<UrlImportResponse> {
  const idempotencyKey = `import-url-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return request<UrlImportResponse>("/api/v1/import/url", {
    method: "POST",
    body: JSON.stringify({
      userId,
      sourceUrl,
      maxImages,
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

/** @deprecated Use getLpBalance() instead */
export async function getAiUsage(): Promise<AiUsageResponse> {
  return getLpBalance();
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

// ─── LP (Lernpunkte) ──────────────────────────────────────────────────────────

export async function getLpBalance(): Promise<AiUsageResponse> {
  return request<AiUsageResponse>("/api/v1/usage");
}

export async function earnLp(
  type: "session" | "dailyGoal" | "ad",
  sessionCardCount?: number
): Promise<LpEarnResponse> {
  return request<LpEarnResponse>("/api/v1/lp/earn", {
    method: "POST",
    body: JSON.stringify({ type, sessionCardCount }),
  });
}

export async function claimMilestone(
  milestone: "first_deck" | "first_review" | "streak_7" | "streak_30" | "streak_100"
): Promise<LpMilestoneResponse> {
  return request<LpMilestoneResponse>("/api/v1/lp/milestone", {
    method: "POST",
    body: JSON.stringify({ milestone }),
  });
}

// ─── LP Pack Purchase ──────────────────────────────────────────────────────────

export interface LpPurchaseResponse {
  lpGranted: number;
  newBalance: number;
}

export async function grantLpPackPurchase(
  packId: string,
  transactionId: string
): Promise<LpPurchaseResponse> {
  return request<LpPurchaseResponse>("/api/v1/lp/purchase", {
    method: "POST",
    body: JSON.stringify({ packId, transactionId }),
  });
}

// ─── Referral ──────────────────────────────────────────────────────────────────

export interface ReferralClaimResponse {
  success: boolean;
  lpGranted: number;
  newBalance: number;
  referrerHandle?: string;
}

export interface ReferralInfoResponse {
  referralCode: string;
  referredCount: number;
  lpEarnedFromReferrals: number;
}

export async function claimReferralCode(code: string): Promise<ReferralClaimResponse> {
  return request<ReferralClaimResponse>("/api/v1/referral/claim", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function getReferralInfo(): Promise<ReferralInfoResponse> {
  return request<ReferralInfoResponse>("/api/v1/referral/info");
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  lpBalance: number;
  tier: string;
  currentStreak: number;
  isCurrentUser: boolean;
}

export interface GlobalLeaderboardResponse {
  entries: LeaderboardEntry[];
  myRank: number;
  total: number;
}

export interface FriendsLeaderboardResponse {
  entries: LeaderboardEntry[];
  friendCount: number;
}

export async function getGlobalLeaderboard(): Promise<GlobalLeaderboardResponse> {
  return request<GlobalLeaderboardResponse>("/api/v1/leaderboard/global");
}

export async function getFriendsLeaderboard(): Promise<FriendsLeaderboardResponse> {
  return request<FriendsLeaderboardResponse>("/api/v1/leaderboard/friends");
}

// ─── Friends ──────────────────────────────────────────────────────────────────

export interface FriendProfile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  lpBalance: number;
  currentStreak: number;
  lastReviewDate: string | null;
  streakInDanger: boolean;
}

export async function getFriends(): Promise<{ friends: FriendProfile[] }> {
  return request<{ friends: FriendProfile[] }>("/api/v1/friends");
}

export async function addFriend(friendId: string): Promise<{ added: boolean; friendId: string }> {
  return request<{ added: boolean; friendId: string }>("/api/v1/friends", {
    method: "POST",
    body: JSON.stringify({ friendId }),
  });
}

export async function removeFriend(friendId: string): Promise<{ removed: boolean }> {
  return request<{ removed: boolean }>(`/api/v1/friends?friendId=${friendId}`, {
    method: "DELETE",
  });
}

// ─── Push Notifications ───────────────────────────────────────────────────────

export async function registerPushToken(
  token: string,
  platform: "ios" | "android" | "web"
): Promise<{ registered: boolean }> {
  return request<{ registered: boolean }>("/api/v1/push/register", {
    method: "POST",
    body: JSON.stringify({ token, platform }),
  });
}
