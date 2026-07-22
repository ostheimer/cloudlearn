// API client for communicating with the clearn backend
import { supabase } from "./supabase";

// Configurable via env (staging/preview builds); production URL as fallback
// so builds without env configuration keep working (#77).
const API_BASE =
  process.env.EXPO_PUBLIC_API_URL?.trim() || "https://clearn-api.vercel.app";

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

async function request<T>(
  path: string,
  options?: RequestInit,
  config?: { requiresAuth?: boolean }
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const authHeaders = await getAuthHeaders();

  if (config?.requiresAuth && !authHeaders.Authorization) {
    throw new ApiError("Authentication required", 401, "UNAUTHORIZED_CLIENT");
  }

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
    // Die Bezahlschranke öffnet sich NUR noch beim echten Pro-Gate.
    //
    // Vorher trugen auch "Deck voll" und "zu viele Decks" den Code
    // PAYWALL_REQUIRED, weshalb ein Pro-Nutzer mit vollem Deck aufgefordert
    // wurde, Pro zu kaufen (#371). Seit dem Server-Fix haben die Grenzen ihre
    // eigenen Codes; ob dort ein Kauf hilft, entscheidet der Bildschirm über
    // adviceForLimit() — der kennt den Tarif der Nutzerin.
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

async function requestAuthenticated<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  return request<T>(path, options, { requiresAuth: true });
}

function importIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

export interface PdfImportResponse extends ScanResponse {
  fileName: string;
  pageCount: number;
  extractedCharacters: number;
  usage?: LpUsageInfo;
}

export interface AiUsageResponse {
  tier: "free" | "pro" | "lifetime";
  lpBalance: number;
  lpEarnedToday: number;
  lpAdsToday: number;
  lpEarnCapToday: number;
  lpAdCapToday: number;
  lpCostAiScan: number;
  lpCostUrlImport: number;
  lpCostPdfImport: number;
  periodStart: string | null;
  /**
   * Tarif-Grenzen (#411). Optional, weil ältere Server sie nicht mitschicken —
   * die App darf ohne sie nur nicht mehr vorwarnen, nichts blockieren.
   */
  limits?: { maxDecks: number; maxCardsPerDeck: number };
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
  /** Cards you can study normally — excludes Bild-Occlusion (own mode). */
  cardCount?: number;
  /** Bild-Occlusion cards, counted separately ("20 Karten · 10 Bilder"). */
  imageCardCount?: number;
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
  // Image cards (Occlusion, #207): storage path of the image + per-card payload
  // ({ regions, hideIndex }). Absent on normal text cards.
  sourceImageUrl?: string;
  extraData?: Record<string, unknown>;
}

export interface ReviewResponse {
  requestId: string;
  cardId: string;
  nextDueAt: string;
  stability: number;
  difficulty: number;
  state: string;
}

export interface ReviewSyncPayload {
  userId: string;
  cardId: string;
  rating: "again" | "hard" | "good" | "easy";
  reviewedAt: string;
  reviewDurationMs?: number;
  idempotencyKey: string;
  /**
   * Aus welchem Modus die Wiederholung stammt (siehe ReviewMode).
   *
   * Steht bewusst IM Payload, nicht nur am Aufruf: Lernen, Üben und Lückentext
   * reichen genau dieses Objekt sowohl an reviewCard als auch — bei Netzfehler
   * — in die Offline-Warteschlange weiter. Nur so trägt auch die später
   * nachgereichte Wiederholung ihr Etikett.
   *
   * Optional, weil bereits gespeicherte Warteschlangen-Einträge aus der Zeit
   * vor dieser Änderung kein mode haben. Die tragen der Server-Default
   * "flashcard" — dasselbe Etikett, das sie ohne diese Änderung bekommen
   * hätten.
   */
  mode?: ReviewMode;
}

export interface ReviewSyncOperation {
  operationId: string;
  operationType: "review";
  createdAt: string;
  payload: ReviewSyncPayload;
}

export interface SyncResponse {
  requestId: string;
  acceptedOperationIds: string[];
  rejectedOperationIds: string[];
  serverTimestamp: string;
}

export interface StatsResponse {
  totalDecks: number;
  dueCards: number;
  currentStreak: number;
  longestStreak: number;
  lastReviewDate: string | null;
  dailyGoal: number;
  // Streak freezes owned (LP store item); optional while old API versions roll out.
  streakFreezes?: number;
  // Streak repair (reactive counterpart to the freeze); optional during rollout.
  repairAvailable?: boolean;
  repairBrokenStreak?: number;
  repairCost?: number;
  reviewsToday: number;
  reviewsThisWeek: number;
  reviewsTotal: number;
  // Accuracy over the last `statsWindowDays` days — not since the beginning.
  accuracyRate: number;
  // Answers in that same window: the denominator behind accuracyRate. Tells
  // "nothing studied in this window" (dash) from "all wrong" (0%). Optional
  // while older API versions age out.
  reviewsInWindow?: number;
  // The window actually served (Free is clamped to 7) — for the label.
  statsWindowDays?: 7 | 30;
  reviewsByDay: Array<{ date: string; count: number }>;
  accuracyByDay?: Array<{ date: string; accuracy: number; count: number }>;
  // Deck of the user's most recent review ("Zuletzt gelernt" on Home).
  // `reviewedAt` may be absent when talking to an API older than #415.
  lastStudiedDeck?: { id: string; title: string; reviewedAt?: string } | null;
}

export interface SubscriptionStatus {
  userId: string;
  tier: "free" | "pro" | "lifetime";
  isActive: boolean;
  expiresAt: string | null;
}

export interface DeleteAccountResponse {
  requestId: string;
  deleted: true;
  message: string;
  warning?: string;
}

// --- API Methods ---

// #442: `preview` erzeugt die Karten, speichert sie aber NICHT (der Server legt
// dann nichts an). Genau das behebt den Doppel-Deck-Bug: Bisher legte der Scan
// serverseitig sofort ein Deck an UND die App beim „Speichern" ein zweites — mit
// preview entsteht nur noch das eine Deck, das die App beim Speichern anlegt.
// Voreinstellung `false`: ohne Flag verhält sich der Aufruf unverändert.
export async function scanText(
  userId: string,
  text: string,
  language = "de",
  idempotencyKey?: string,
  preview = false
): Promise<ScanResponse> {
  return requestAuthenticated<ScanResponse>("/api/v1/scan/process", {
    method: "POST",
    body: JSON.stringify({
      userId,
      extractedText: text,
      idempotencyKey: idempotencyKey ?? importIdempotencyKey("scan"),
      sourceLanguage: language,
      preview,
    }),
  });
}

export async function scanImage(
  userId: string,
  imageBase64: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
  language = "de",
  idempotencyKey?: string,
  preview = false
): Promise<ScanResponse> {
  return requestAuthenticated<ScanResponse>("/api/v1/scan/process", {
    method: "POST",
    body: JSON.stringify({
      userId,
      imageBase64,
      imageMimeType: mimeType,
      idempotencyKey: idempotencyKey ?? importIdempotencyKey("scan-img"),
      sourceLanguage: language,
      preview,
    }),
  });
}

export async function importFromUrl(
  userId: string,
  sourceUrl: string,
  maxImages = 4,
  language = "de",
  idempotencyKey?: string,
  preview = false
): Promise<UrlImportResponse> {
  return requestAuthenticated<UrlImportResponse>("/api/v1/import/url", {
    method: "POST",
    body: JSON.stringify({
      userId,
      sourceUrl,
      maxImages,
      idempotencyKey: idempotencyKey ?? importIdempotencyKey("import-url"),
      sourceLanguage: language,
      preview,
    }),
  });
}

export async function importPdf(
  userId: string,
  fileName: string,
  fileBase64: string,
  language = "de",
  idempotencyKey?: string,
  preview = false
): Promise<PdfImportResponse> {
  return requestAuthenticated<PdfImportResponse>("/api/v1/import/pdf", {
    method: "POST",
    body: JSON.stringify({
      userId,
      fileName,
      fileBase64,
      idempotencyKey: idempotencyKey ?? importIdempotencyKey("import-pdf"),
      sourceLanguage: language,
      preview,
    }),
  });
}

export async function createDeck(
  userId: string,
  title: string,
  tags: string[] = []
): Promise<{ deck: Deck }> {
  return requestAuthenticated<{ deck: Deck }>("/api/v1/decks", {
    method: "POST",
    body: JSON.stringify({ userId, title, tags }),
  });
}

export async function listDecks(
  userId: string
): Promise<{ decks: Deck[] }> {
  return requestAuthenticated<{ decks: Deck[] }>(`/api/v1/decks?userId=${userId}`);
}

export async function createCard(
  userId: string,
  deckId: string,
  card: {
    front: string;
    back: string;
    type: string;
    difficulty: string;
    tags: string[];
    // Image cards (Occlusion, #207): storage path + per-card payload. The API
    // accepts these on the shared flashcard schema; only sent when present.
    sourceImageUrl?: string;
    extraData?: Record<string, unknown>;
  }
): Promise<{ card: Card }> {
  return requestAuthenticated<{ card: Card }>("/api/v1/cards", {
    method: "POST",
    body: JSON.stringify({
      userId,
      deckId,
      card: {
        front: card.front,
        back: card.back,
        type: card.type,
        difficulty: card.difficulty,
        tags: card.tags,
        ...(card.sourceImageUrl ? { sourceImageUrl: card.sourceImageUrl } : {}),
        ...(card.extraData ? { extraData: card.extraData } : {}),
      },
    }),
  });
}

export async function getDueCards(
  userId: string
): Promise<{ cards: Card[] }> {
  return requestAuthenticated<{ cards: Card[] }>(`/api/v1/learn/due?userId=${userId}`);
}

/**
 * Woher eine Wiederholung stammt. Der Server entscheidet daran, was sie
 * auslöst: Abruf-Modi bewegen den Lernplan, "test" gibt keine Lernpunkte,
 * "quiz"/"match" geben Punkte, rühren den Plan aber nur bei Fehlern an.
 *
 * Wird nichts geschickt, trägt der Server "flashcard" ein. Für Lernen, Üben,
 * Lückentext und Bild-Abdecken ist das folgenlos — alle vier gelten ohnehin
 * als echter Abruf und werden identisch behandelt.
 */
export type ReviewMode =
  | "flashcard"
  | "practice"
  | "cloze"
  | "occlusion"
  | "quiz"
  | "match"
  | "test";

export async function reviewCard(
  userId: string,
  cardId: string,
  rating: "again" | "hard" | "good" | "easy",
  options?: {
    reviewedAt?: string;
    reviewDurationMs?: number;
    idempotencyKey?: string;
    mode?: ReviewMode;
  }
): Promise<ReviewResponse> {
  const reviewedAt = options?.reviewedAt ?? new Date().toISOString();
  const idempotencyKey =
    options?.idempotencyKey ??
    `review-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const body: {
    userId: string;
    cardId: string;
    rating: "again" | "hard" | "good" | "easy";
    reviewedAt: string;
    idempotencyKey: string;
    reviewDurationMs?: number;
    mode?: ReviewMode;
  } = {
    userId,
    cardId,
    rating,
    reviewedAt,
    idempotencyKey,
  };

  if (options?.reviewDurationMs !== undefined) {
    body.reviewDurationMs = options.reviewDurationMs;
  }

  if (options?.mode !== undefined) {
    body.mode = options.mode;
  }

  return requestAuthenticated<ReviewResponse>(`/api/v1/cards/${cardId}/review`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function syncReviewOperations(
  userId: string,
  operations: ReviewSyncOperation[]
): Promise<SyncResponse> {
  return requestAuthenticated<SyncResponse>("/api/v1/learn/sync", {
    method: "POST",
    body: JSON.stringify({
      userId,
      operations,
    }),
  });
}

// --- Deck Management ---

export async function updateDeck(
  deckId: string,
  updates: { title?: string; tags?: string[] }
): Promise<{ deck: Deck }> {
  return requestAuthenticated<{ deck: Deck }>(`/api/v1/decks/${deckId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteDeck(deckId: string): Promise<{ deleted: boolean }> {
  return requestAuthenticated<{ deleted: boolean }>(`/api/v1/decks/${deckId}`, {
    method: "DELETE",
  });
}

export async function listCardsInDeck(
  deckId: string
): Promise<{ cards: Card[] }> {
  return requestAuthenticated<{ cards: Card[] }>(`/api/v1/decks/${deckId}/cards`);
}

export interface CardSearchResult {
  cardId: string;
  deckId: string;
  deckTitle: string;
  front: string;
  back: string;
}

// Search the user's own cards by front/back text (Bibliothek card search).
export async function searchCards(
  query: string
): Promise<{ results: CardSearchResult[] }> {
  return requestAuthenticated<{ results: CardSearchResult[] }>(
    `/api/v1/cards/search?q=${encodeURIComponent(query)}`
  );
}

// --- Card Management ---

export async function updateCard(
  cardId: string,
  updates: { front?: string; back?: string; type?: string; difficulty?: string; tags?: string[]; starred?: boolean }
): Promise<{ card: Card }> {
  return requestAuthenticated<{ card: Card }>(`/api/v1/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteCard(cardId: string): Promise<{ deleted: boolean }> {
  return requestAuthenticated<{ deleted: boolean }>(`/api/v1/cards/${cardId}`, {
    method: "DELETE",
  });
}

// --- Subscription ---

export async function getSubscriptionStatus(
  _userId?: string
): Promise<{ status: SubscriptionStatus }> {
  return requestAuthenticated<{ status: SubscriptionStatus }>("/api/v1/subscription/status");
}

export async function deleteAccount(): Promise<DeleteAccountResponse> {
  return requestAuthenticated<DeleteAccountResponse>("/api/v1/account", {
    method: "DELETE",
  });
}

/** @deprecated Use getLpBalance() instead */
export async function getAiUsage(): Promise<AiUsageResponse> {
  return getLpBalance();
}

// --- Stats ---

export async function getStats(): Promise<{ stats: StatsResponse }> {
  return requestAuthenticated<{ stats: StatsResponse }>("/api/v1/stats");
}

// --- Folders ---

export interface Folder {
  id: string;
  userId: string;
  title: string;
  /** Freitext unter dem Namen, wie ihn früher nur Kurse hatten (#437). */
  description: string | null;
  parentId: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listFolders(): Promise<{ folders: Folder[] }> {
  return requestAuthenticated<{ folders: Folder[] }>("/api/v1/folders");
}

export async function getFolder(folderId: string): Promise<{ folder: Folder }> {
  return requestAuthenticated<{ folder: Folder }>(`/api/v1/folders/${folderId}`);
}

export async function createFolder(
  title: string,
  parentId?: string,
  color?: string
): Promise<{ folder: Folder }> {
  return requestAuthenticated<{ folder: Folder }>("/api/v1/folders", {
    method: "POST",
    body: JSON.stringify({ title, parentId, color }),
  });
}

export async function updateFolderApi(
  folderId: string,
  updates: { title?: string; parentId?: string | null; color?: string; description?: string }
): Promise<{ folder: Folder }> {
  return requestAuthenticated<{ folder: Folder }>(`/api/v1/folders/${folderId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteFolderApi(folderId: string): Promise<{ deleted: boolean }> {
  return requestAuthenticated<{ deleted: boolean }>(`/api/v1/folders/${folderId}`, {
    method: "DELETE",
  });
}

export async function addDeckToFolder(
  folderId: string,
  deckId: string
): Promise<{ added: boolean }> {
  return requestAuthenticated<{ added: boolean }>(`/api/v1/folders/${folderId}/decks`, {
    method: "POST",
    body: JSON.stringify({ deckId }),
  });
}

export async function removeDeckFromFolder(
  folderId: string,
  deckId: string
): Promise<{ removed: boolean }> {
  return requestAuthenticated<{ removed: boolean }>(`/api/v1/folders/${folderId}/decks?deckId=${deckId}`, {
    method: "DELETE",
  });
}

export async function listDecksInFolder(
  folderId: string
): Promise<{ decks: Deck[] }> {
  return requestAuthenticated<{ decks: Deck[] }>(`/api/v1/folders/${folderId}/decks`);
}

/**
 * Reihenfolge der Decks im Ordner speichern (#437). `deckIds` ist die
 * komplette gewünschte Reihenfolge, vorne = oben.
 */
export async function setFolderDeckOrder(
  folderId: string,
  deckIds: string[]
): Promise<{ reordered: boolean }> {
  return requestAuthenticated<{ reordered: boolean }>(`/api/v1/folders/${folderId}/decks`, {
    method: "PUT",
    body: JSON.stringify({ deckIds }),
  });
}

// --- Deck Actions (Duplicate, Share, Export, Details) ---

export async function duplicateDeck(deckId: string): Promise<{ deck: Deck }> {
  return requestAuthenticated<{ deck: Deck }>(`/api/v1/decks/${deckId}/duplicate`, {
    method: "POST",
  });
}

export async function shareDeck(deckId: string): Promise<{ shareToken: string; shareUrl: string }> {
  return requestAuthenticated<{ shareToken: string; shareUrl: string }>(`/api/v1/decks/${deckId}/share`, {
    method: "POST",
  });
}

export async function getSharedDeck(shareToken: string): Promise<{ deck: Deck; cards: Card[] }> {
  return request<{ deck: Deck; cards: Card[] }>(`/api/v1/decks/share/${shareToken}`);
}

/**
 * Imports a shared deck into the signed-in user's library as an independent
 * copy (fresh FSRS progress). Requires only the share token, not ownership.
 */
export async function importSharedDeck(shareToken: string): Promise<{ deck: Deck }> {
  return requestAuthenticated<{ deck: Deck }>(`/api/v1/decks/share/${shareToken}/import`, {
    method: "POST",
  });
}

export interface DeckDetails {
  id: string;
  userId: string;
  title: string;
  tags: string[];
  cardCount: number;
  folders: Folder[];
  createdAt: string;
  updatedAt: string;
}

export async function getDeckDetails(deckId: string): Promise<{ details: DeckDetails }> {
  return requestAuthenticated<{ details: DeckDetails }>(`/api/v1/decks/${deckId}/details`);
}

export async function exportDeckForOffline(
  deckId: string
): Promise<{ deck: Deck; cards: Card[]; exportedAt: string }> {
  return requestAuthenticated<{ deck: Deck; cards: Card[]; exportedAt: string }>(`/api/v1/decks/${deckId}/export`);
}

// ─── LP (Lernpunkte) ──────────────────────────────────────────────────────────

export async function getLpBalance(): Promise<AiUsageResponse> {
  return requestAuthenticated<AiUsageResponse>("/api/v1/usage");
}

export async function earnLp(
  type: "session" | "dailyGoal" | "ad",
  sessionCardCount?: number
): Promise<LpEarnResponse> {
  return requestAuthenticated<LpEarnResponse>("/api/v1/lp/earn", {
    method: "POST",
    body: JSON.stringify({ type, sessionCardCount }),
  });
}

export async function claimMilestone(
  milestone: "first_deck" | "first_review" | "streak_7" | "streak_30" | "streak_100"
): Promise<LpMilestoneResponse> {
  return requestAuthenticated<LpMilestoneResponse>("/api/v1/lp/milestone", {
    method: "POST",
    body: JSON.stringify({ milestone }),
  });
}

// ─── Streak Freeze (LP store item) ────────────────────────────────────────────

export interface StreakFreezePurchaseResponse {
  cost: number;
  newBalance: number;
  streakFreezes: number;
  maxFreezes: number;
}

export async function buyStreakFreeze(): Promise<StreakFreezePurchaseResponse> {
  return requestAuthenticated<StreakFreezePurchaseResponse>("/api/v1/lp/streak-freeze", {
    method: "POST",
  });
}

export interface StreakRepairResponse {
  cost: number;
  newBalance: number;
  currentStreak: number;
}

export async function buyStreakRepair(): Promise<StreakRepairResponse> {
  return requestAuthenticated<StreakRepairResponse>("/api/v1/lp/streak-repair", {
    method: "POST",
  });
}

// ─── Streak Calendar ──────────────────────────────────────────────────────────

export interface StreakCalendarResponse {
  month: string;
  learnedDays: string[];
  frozenDays: string[];
}

export async function getStreakCalendar(month: string): Promise<StreakCalendarResponse> {
  return requestAuthenticated<StreakCalendarResponse>(
    `/api/v1/stats/streak-calendar?month=${encodeURIComponent(month)}`
  );
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
  return requestAuthenticated<LpPurchaseResponse>("/api/v1/lp/purchase", {
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
  return requestAuthenticated<ReferralClaimResponse>("/api/v1/referral/claim", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function getReferralInfo(): Promise<ReferralInfoResponse> {
  return requestAuthenticated<ReferralInfoResponse>("/api/v1/referral/info");
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
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
  return requestAuthenticated<GlobalLeaderboardResponse>("/api/v1/leaderboard/global");
}

export async function getFriendsLeaderboard(): Promise<FriendsLeaderboardResponse> {
  return requestAuthenticated<FriendsLeaderboardResponse>("/api/v1/leaderboard/friends");
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
  return requestAuthenticated<{ friends: FriendProfile[] }>("/api/v1/friends");
}

export async function addFriend(friendId: string): Promise<{ added: boolean; friendId: string }> {
  return requestAuthenticated<{ added: boolean; friendId: string }>("/api/v1/friends", {
    method: "POST",
    body: JSON.stringify({ friendId }),
  });
}

export async function removeFriend(friendId: string): Promise<{ removed: boolean }> {
  return requestAuthenticated<{ removed: boolean }>(`/api/v1/friends?friendId=${friendId}`, {
    method: "DELETE",
  });
}

export interface AddFriendByCodeResponse {
  added: boolean;
  friend: { userId: string; displayName: string; avatarUrl: string | null };
  // One-time referral LP bonus granted by the same action (0 if already used).
  lpGranted: number;
  newBalance?: number;
}

// Add a friend by their share code (the referral code, reused as a friend code).
export async function addFriendByCode(code: string): Promise<AddFriendByCodeResponse> {
  return requestAuthenticated<AddFriendByCodeResponse>("/api/v1/friends/by-code", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

// ─── Friend Streaks (shared streaks, #237) ─────────────────────────────────────

export interface FriendStreak {
  friendId: string;
  displayName: string;
  avatarUrl: string | null;
  status: "pending" | "active";
  currentStreak: number;
  longestStreak: number;
  youStudiedToday: boolean;
  friendStudiedToday: boolean;
  invitedByYou: boolean;
}

export async function getFriendStreaks(): Promise<{ streaks: FriendStreak[] }> {
  return requestAuthenticated<{ streaks: FriendStreak[] }>("/api/v1/friends/streaks");
}

export async function inviteFriendStreak(friendId: string): Promise<{ result: string }> {
  return requestAuthenticated<{ result: string }>("/api/v1/friends/streaks", {
    method: "POST",
    body: JSON.stringify({ friendId, action: "invite" }),
  });
}

export async function acceptFriendStreak(friendId: string): Promise<{ accepted: boolean }> {
  return requestAuthenticated<{ accepted: boolean }>("/api/v1/friends/streaks", {
    method: "POST",
    body: JSON.stringify({ friendId, action: "accept" }),
  });
}

export async function remindFriendStreak(friendId: string): Promise<{ sent: boolean }> {
  return requestAuthenticated<{ sent: boolean }>("/api/v1/friends/streaks", {
    method: "POST",
    body: JSON.stringify({ friendId, action: "remind" }),
  });
}

export async function leaveFriendStreak(friendId: string): Promise<{ left: boolean }> {
  return requestAuthenticated<{ left: boolean }>(`/api/v1/friends/streaks?friendId=${friendId}`, {
    method: "DELETE",
  });
}

// ─── Push Notifications ───────────────────────────────────────────────────────

export async function registerPushToken(
  token: string,
  platform: "ios" | "android" | "web"
): Promise<{ registered: boolean }> {
  return requestAuthenticated<{ registered: boolean }>("/api/v1/push/register", {
    method: "POST",
    body: JSON.stringify({ token, platform }),
  });
}
