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
  /** Karten, die man normal lernt — ohne Bild-Occlusion (eigener Modus). */
  cardCount?: number;
  /** Bild-Occlusion-Karten, getrennt gezählt („20 Karten · 10 Bild-Karten"). */
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
  // Bild-Karten (Occlusion): Speicherpfad des Bildes + freie Zusatzdaten
  // (für Occlusion: { regions, hideIndex }).
  sourceImageUrl?: string;
  extraData?: Record<string, unknown>;
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
  // Genauigkeit der letzten `statsWindowDays` Tage — nicht seit Anbeginn.
  accuracyRate: number;
  // Antworten im selben Fenster: der Nenner hinter accuracyRate. Unterscheidet
  // "nichts gelernt in dem Zeitraum" (Strich) von "alles falsch" (0 %).
  // Optional während alte API-Versionen auslaufen.
  reviewsInWindow?: number;
  // Dieselbe Quote, getrennt nach Art der Antwort: abgerufen (aus dem Kopf) vs.
  // wiedererkannt (aus einer Auswahl getippt). Jede Gruppe bringt ihren eigenen
  // Nenner mit — `answers: 0` heißt "in dem Zeitraum nicht gemacht" und gehört
  // als Strich angezeigt. Prüfungen zählen in KEINER Gruppe, die summieren sich
  // deshalb absichtlich nicht auf `reviewsInWindow`.
  // Optional während alte API-Versionen auslaufen.
  accuracyByKind?: {
    recall: { rate: number; answers: number };
    recognition: { rate: number; answers: number };
  };
  // Das tatsächlich gelieferte Fenster (Free wird auf 7 geklemmt), zum Beschriften.
  statsWindowDays?: 7 | 30;
  reviewsByDay: Array<{ date: string; count: number }>;
  accuracyByDay?: Array<{ date: string; accuracy: number; count: number }>;
  // Streak-Freezes (LP-Store-Artikel), optional während alte API-Versionen auslaufen.
  streakFreezes?: number;
  // Streak-Reparatur (reaktives Gegenstück zum Freeze), optional während des Rollouts.
  repairAvailable?: boolean;
  repairBrokenStreak?: number;
  repairCost?: number;
  // Deck des zuletzt gelernten Reviews ("Zuletzt gelernt" auf der Home).
  lastStudiedDeck?: { id: string; title: string } | null;
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
    sourceImageUrl?: string;
    extraData?: Record<string, unknown>;
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
        // API card types: basic | cloze | mcq | matching | occlusion (see cardService flashcardSchema)
        type: card.type ?? "basic",
        difficulty: card.difficulty ?? "medium",
        tags: card.tags ?? [],
        ...(card.sourceImageUrl ? { sourceImageUrl: card.sourceImageUrl } : {}),
        ...(card.extraData ? { extraData: card.extraData } : {}),
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

/**
 * Aus welchem Modus eine Wiederholung stammt. Der Server entscheidet daran, wer
 * sie mitzählt: Abruf-Modi bewegen den Lernplan, Rate-Modi nur bei Fehlern, und
 * „test" gibt keine Lernpunkte. Ohne Angabe gilt „flashcard".
 */
export type ReviewMode =
  | "flashcard"
  | "practice"
  | "cloze"
  | "occlusion"
  | "quiz"
  | "match"
  | "test";

export function reviewCard(
  userId: string,
  cardId: string,
  rating: ReviewRating,
  options?: { reviewedAt?: string; reviewDurationMs?: number; mode?: ReviewMode }
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
    mode?: ReviewMode;
  } = { userId, cardId, rating, reviewedAt, idempotencyKey };
  if (options?.reviewDurationMs !== undefined) {
    body.reviewDurationMs = options.reviewDurationMs;
  }
  if (options?.mode !== undefined) {
    body.mode = options.mode;
  }
  return authed<ReviewResponse>(`/api/v1/cards/${cardId}/review`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface TestAttemptResult {
  id: string;
  deckId: string;
  questionCount: number;
  correctCount: number;
  submittedAt: string;
}

/**
 * Eine ABGEGEBENE Prüfung als eine Zeile protokollieren (test_attempts).
 *
 * Das ist NICHT der Weg für Streak, Statistik-Menge oder Lernplan — die hängen
 * weiter an den einzelnen `reviewCard(..., { mode: "test" })`-Aufrufen, die
 * daneben laufen. Hier wird nur die Prüfung als Einheit festgehalten, damit die
 * letzten Prüfungen mit Deck, Datum und „18 von 30" dastehen können.
 *
 * Nur die Antwortliste, nie das Ergebnis: der Server zählt selbst gegen die
 * echten, nicht gelöschten Karten des Decks. Ein gefälschtes „30 von 30" kostet
 * damit mindestens 30 echte Karten.
 */
export function recordTestAttempt(
  userId: string,
  deckId: string,
  idempotencyKey: string,
  answers: Array<{ cardId: string; correct: boolean }>
): Promise<TestAttemptResult> {
  return authed<TestAttemptResult>(`/api/v1/decks/${deckId}/tests`, {
    method: "POST",
    body: JSON.stringify({ userId, idempotencyKey, answers }),
  });
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export function getStats(days?: 7 | 30): Promise<{ stats: StatsResponse }> {
  return authed<{ stats: StatsResponse }>(
    `/api/v1/stats${days ? `?days=${days}` : ""}`
  );
}

// Tagesziel (Karten/Tag) setzen — reiner Anzeige-Zielwert, ohne Einfluss auf
// LP-Verdienst oder -Deckel. Der Server begrenzt final auf [1, 500] und nimmt
// die Identität aus dem Token (gleicher Endpunkt wie die App, profileApi.ts).
export function setDailyGoal(goal: number): Promise<{ dailyGoal: number }> {
  return authed<{ dailyGoal: number }>(`/api/v1/daily-goal`, {
    method: "PATCH",
    body: JSON.stringify({ dailyGoal: goal }),
  });
}

// Pro-Deck-Genauigkeit (letzte 30 Tage) — für die „Pro Deck"-Liste in der Statistik.
export interface DeckSummary {
  deckId: string;
  title: string;
  answersTotal: number;
  accuracyRate: number;
}
export function getDeckSummaries(): Promise<{ decks: DeckSummary[] }> {
  return authed<{ decks: DeckSummary[] }>("/api/v1/stats/decks");
}

// Statistik für EIN Deck (Verlauf im 7/30-Fenster + „Wackelkandidaten" all-time).
export interface DeckWobblyCard {
  cardId: string;
  front: string;
  back: string;
  wrongCount: number;
  lastWrongAt: string;
}
export interface DeckStats {
  deck: { id: string; title: string };
  answersTotal: number;
  answersCorrect: number;
  accuracyByDay: Array<{ date: string; accuracy: number; count: number }>;
  wobblyCards: DeckWobblyCard[];
}
export function getDeckStats(deckId: string, days: 7 | 30 = 30): Promise<DeckStats> {
  return authed<DeckStats>(
    `/api/v1/decks/${encodeURIComponent(deckId)}/stats?days=${days}`
  );
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
  // #411: Wie viele Karten die KI erkannt hat und wie viele davon wirklich ins
  // Deck passten. Weichen sie ab, hat die Tarifgrenze gleichmäßig ausgedünnt.
  // Optional, weil ein älterer Server sie nicht mitschickt.
  generatedCount?: number;
  savedCount?: number;
}

export interface UrlImportResponse extends ScanResponse {
  sourceUrl: string;
  imagesUsed: number;
}

export interface PdfImportResponse extends ScanResponse {
  fileName: string;
  pageCount: number;
  extractedCharacters: number;
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
  periodStart?: string | null;
  // #411: Die Tarifgrenzen, damit der Client sie kennt, BEVOR Lernpunkte
  // fließen. Optional, weil ein älterer Server sie nicht mitschickt — fehlen
  // sie, wird nichts gesperrt (siehe src/lib/import-limits.ts).
  limits?: { maxDecks: number; maxCardsPerDeck: number };
}

function importIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Erzeugt per KI Flashcards aus reinem Text. Ohne `deckId` legt der Server ein
 * neues Deck an, mit `deckId` schreibt er in das vorhandene (#427).
 */
export function scanText(
  userId: string,
  text: string,
  language = "de",
  idempotencyKey?: string,
  deckId?: string,
  preview?: boolean
): Promise<ScanResponse> {
  return authed<ScanResponse>("/api/v1/scan/process", {
    method: "POST",
    body: JSON.stringify({
      userId,
      extractedText: text,
      idempotencyKey: idempotencyKey ?? importIdempotencyKey("scan"),
      sourceLanguage: language,
      ...(deckId ? { deckId } : {}),
      ...(preview ? { preview: true } : {}),
    }),
  });
}

/** Wie {@link scanText}, nur aus einer Webseiten-URL. */
export function importFromUrl(
  userId: string,
  sourceUrl: string,
  maxImages = 4,
  language = "de",
  idempotencyKey?: string,
  deckId?: string,
  preview?: boolean
): Promise<UrlImportResponse> {
  return authed<UrlImportResponse>("/api/v1/import/url", {
    method: "POST",
    body: JSON.stringify({
      userId,
      sourceUrl,
      maxImages,
      idempotencyKey: idempotencyKey ?? importIdempotencyKey("import-url"),
      sourceLanguage: language,
      ...(deckId ? { deckId } : {}),
      ...(preview ? { preview: true } : {}),
    }),
  });
}

/**
 * Erzeugt per KI Flashcards aus einem Foto. Nutzt denselben Endpunkt wie der
 * Text-Scan (Bild statt Text). imageBase64 ist „nackt" (ohne data-URI-Präfix).
 * Legt serverseitig ein neues Deck an.
 */
export function scanImage(
  userId: string,
  imageBase64: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
  language = "de",
  idempotencyKey?: string,
  deckId?: string,
  preview?: boolean
): Promise<ScanResponse> {
  return authed<ScanResponse>("/api/v1/scan/process", {
    method: "POST",
    body: JSON.stringify({
      userId,
      imageBase64,
      imageMimeType: mimeType,
      idempotencyKey: idempotencyKey ?? importIdempotencyKey("scan-img"),
      sourceLanguage: language,
      ...(deckId ? { deckId } : {}),
      ...(preview ? { preview: true } : {}),
    }),
  });
}

/**
 * Erzeugt per KI Flashcards aus einem PDF. fileBase64 ist „nackt" (ohne
 * data-URI-Präfix). Legt serverseitig ein neues Deck an. Reine Scan-PDFs ohne
 * Text lehnt der Server mit 422 PDF_TEXT_NOT_FOUND ab.
 */
export function importPdf(
  userId: string,
  fileName: string,
  fileBase64: string,
  language = "de",
  idempotencyKey?: string,
  deckId?: string,
  preview?: boolean
): Promise<PdfImportResponse> {
  return authed<PdfImportResponse>("/api/v1/import/pdf", {
    method: "POST",
    body: JSON.stringify({
      userId,
      fileName,
      fileBase64,
      idempotencyKey: idempotencyKey ?? importIdempotencyKey("import-pdf"),
      sourceLanguage: language,
      ...(deckId ? { deckId } : {}),
      ...(preview ? { preview: true } : {}),
    }),
  });
}

/**
 * Legt Karten ab, die zuvor mit `preview` erzeugt und von Hand durchgesehen
 * wurden (#427). Kostet keine Lernpunkte — die flossen beim Erzeugen.
 *
 * Ohne `deckId` entsteht ein neues Deck mit `title`, mit `deckId` wird
 * angehängt. Derselbe `idempotencyKey` liefert dasselbe Ergebnis zurück,
 * statt die Karten ein zweites Mal anzulegen.
 */
export interface ImportSaveResponse {
  deckId: string;
  deckTitle: string;
  cards: Flashcard[];
  generatedCount?: number;
  savedCount?: number;
}
export function saveImportedCards(params: {
  cards: Flashcard[];
  deckId?: string;
  title?: string;
  idempotencyKey?: string;
}): Promise<ImportSaveResponse> {
  return authed<ImportSaveResponse>("/api/v1/import/save", {
    method: "POST",
    body: JSON.stringify({
      cards: params.cards,
      ...(params.deckId ? { deckId: params.deckId } : {}),
      ...(params.title ? { title: params.title } : {}),
      idempotencyKey: params.idempotencyKey ?? importIdempotencyKey("import-save"),
    }),
  });
}

/** Aktueller Lernpunkte-Stand + Kosten pro KI-Aktion. */
export function getLpBalance(): Promise<AiUsageResponse> {
  return authed<AiUsageResponse>("/api/v1/usage");
}

export interface LpEarnResponse {
  granted: number;
  newBalance: number;
  capReached: boolean;
}

/**
 * Schreibt Lernpunkte fürs Lernen gut — wie die App am Ende einer Lernsitzung.
 * Ab 5 gelernten Karten gibt es LP (Tageslimit serverseitig). Web nutzt nur
 * "session"/"dailyGoal" (keine Werbung im Browser).
 */
export function earnLp(
  type: "session" | "dailyGoal",
  sessionCardCount?: number
): Promise<LpEarnResponse> {
  return authed<LpEarnResponse>("/api/v1/lp/earn", {
    method: "POST",
    body: JSON.stringify(
      sessionCardCount !== undefined ? { type, sessionCardCount } : { type }
    ),
  });
}

// ─── Rangliste ─────────────────────────────────────────────────────────────
// Datenminimierung: keine rohen Nutzer-IDs — "bin das ich?" entscheidet der
// Server (isCurrentUser).
export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  avatarUrl: string | null;
  lpBalance: number;
  tier: "free" | "pro" | "lifetime";
  currentStreak: number;
  isCurrentUser: boolean;
}
export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  myRank: number;
  total: number;
}
export function getLeaderboard(): Promise<LeaderboardResponse> {
  return authed<LeaderboardResponse>("/api/v1/leaderboard/global");
}
export interface FriendsLeaderboardResponse {
  entries: LeaderboardEntry[];
  friendCount: number;
}
export function getFriendsLeaderboard(): Promise<FriendsLeaderboardResponse> {
  return authed<FriendsLeaderboardResponse>("/api/v1/leaderboard/friends");
}

// ─── Freunde einladen (Referral) ───────────────────────────────────────────
export interface ReferralInfoResponse {
  referralCode: string | null;
  referredCount: number;
  lpEarnedFromReferrals: number;
}
export function getReferralInfo(): Promise<ReferralInfoResponse> {
  return authed<ReferralInfoResponse>("/api/v1/referral/info");
}

// ─── Konto löschen ─────────────────────────────────────────────────────────
export interface DeleteAccountResponse {
  deleted: boolean;
}
export function deleteAccount(): Promise<DeleteAccountResponse> {
  return authed<DeleteAccountResponse>("/api/v1/account", { method: "DELETE" });
}

// ─── Anzeigename ───────────────────────────────────────────────────────────
// Geprüft wird auf dem Server (Länge, Zeichen, Sperrliste) — der Client
// übersetzt nur die Fehler-Codes in deutsche Meldungen.
export interface ProfileResponse {
  displayName: string | null;
}
export function getProfile(): Promise<ProfileResponse> {
  return authed<ProfileResponse>("/api/v1/account/profile");
}
export function updateDisplayName(displayName: string): Promise<ProfileResponse> {
  return authed<ProfileResponse>("/api/v1/account/profile", {
    method: "PATCH",
    body: JSON.stringify({ displayName }),
  });
}
export function displayNameErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    switch (error.code) {
      case "DISPLAY_NAME_TOO_SHORT":
        return "Der Name muss mindestens 2 Zeichen haben.";
      case "DISPLAY_NAME_TOO_LONG":
        return "Der Name darf höchstens 20 Zeichen haben.";
      case "DISPLAY_NAME_INVALID_CHARS":
        return "Nur Buchstaben, Zahlen, Leerzeichen und . - _ ' sind erlaubt.";
      case "DISPLAY_NAME_NOT_ALLOWED":
        return "Dieser Name ist nicht erlaubt.";
      case "RATE_LIMITED":
        return "Zu viele Änderungen — versuch es in einer Minute noch einmal.";
    }
  }
  return "Der Name konnte nicht gespeichert werden. Versuch es noch einmal.";
}

// ─── Streak-Reparatur ──────────────────────────────────────────────────────
// Reaktives Gegenstück zum Freeze: einen frisch gerissenen Streak gegen LP
// zurückholen. Preis/Fenster/Berechtigung entscheidet der Server (atomare RPC).
export interface StreakRepairResponse {
  cost: number;
  newBalance: number;
  currentStreak: number;
}
export function buyStreakRepair(): Promise<StreakRepairResponse> {
  return authed<StreakRepairResponse>("/api/v1/lp/streak-repair", { method: "POST" });
}

// ─── Streak-Kalender ───────────────────────────────────────────────────────
// Monatsansicht der gelernten und per Freeze geschützten Tage.
export interface StreakCalendarResponse {
  month: string;
  learnedDays: string[];
  frozenDays: string[];
}
export function getStreakCalendar(month: string): Promise<StreakCalendarResponse> {
  return authed<StreakCalendarResponse>(
    `/api/v1/stats/streak-calendar?month=${encodeURIComponent(month)}`
  );
}

// ─── Freunde ───────────────────────────────────────────────────────────────
export interface FriendProfile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  lpBalance: number;
  currentStreak: number;
  lastReviewDate: string | null;
  streakInDanger: boolean;
}
export function getFriends(): Promise<{ friends: FriendProfile[] }> {
  return authed<{ friends: FriendProfile[] }>("/api/v1/friends");
}

// Freund per Code (der Einladungs-/Referral-Code) hinzufügen. Legt die
// Freundschaft beidseitig an und schaltet einmalig den Referral-LP-Bonus frei.
export interface AddFriendByCodeResponse {
  added: boolean;
  friend: { userId: string; displayName: string; avatarUrl: string | null };
  lpGranted: number;
  newBalance?: number;
}
export function addFriendByCode(code: string): Promise<AddFriendByCodeResponse> {
  return authed<AddFriendByCodeResponse>("/api/v1/friends/by-code", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

// ─── Freunde-Streaks (gemeinsame Streaks) ──────────────────────────────────
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
export function getFriendStreaks(): Promise<{ streaks: FriendStreak[] }> {
  return authed<{ streaks: FriendStreak[] }>("/api/v1/friends/streaks");
}
export function inviteFriendStreak(friendId: string): Promise<{ result: string }> {
  return authed<{ result: string }>("/api/v1/friends/streaks", {
    method: "POST",
    body: JSON.stringify({ friendId, action: "invite" }),
  });
}
export function acceptFriendStreak(friendId: string): Promise<{ accepted: boolean }> {
  return authed<{ accepted: boolean }>("/api/v1/friends/streaks", {
    method: "POST",
    body: JSON.stringify({ friendId, action: "accept" }),
  });
}
export function remindFriendStreak(friendId: string): Promise<{ sent: boolean }> {
  return authed<{ sent: boolean }>("/api/v1/friends/streaks", {
    method: "POST",
    body: JSON.stringify({ friendId, action: "remind" }),
  });
}
export function leaveFriendStreak(friendId: string): Promise<{ left: boolean }> {
  return authed<{ left: boolean }>(
    `/api/v1/friends/streaks?friendId=${encodeURIComponent(friendId)}`,
    { method: "DELETE" }
  );
}

// ─── Ordner ─────────────────────────────────────────────────────────────────

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

export function listFolders(): Promise<{ folders: Folder[] }> {
  return authed<{ folders: Folder[] }>("/api/v1/folders");
}

export function createFolder(
  userId: string,
  title: string,
  parentId?: string
): Promise<{ folder: Folder }> {
  return authed<{ folder: Folder }>("/api/v1/folders", {
    method: "POST",
    body: JSON.stringify({ userId, title, parentId }),
  });
}

export function updateFolder(
  folderId: string,
  updates: { title?: string; parentId?: string | null; description?: string }
): Promise<{ folder: Folder }> {
  return authed<{ folder: Folder }>(`/api/v1/folders/${folderId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteFolder(folderId: string): Promise<{ deleted: boolean }> {
  return authed<{ deleted: boolean }>(`/api/v1/folders/${folderId}`, { method: "DELETE" });
}

export function listDecksInFolder(folderId: string): Promise<{ decks: Deck[] }> {
  return authed<{ decks: Deck[] }>(`/api/v1/folders/${folderId}/decks`);
}

export function addDeckToFolder(folderId: string, deckId: string): Promise<{ added: boolean }> {
  return authed<{ added: boolean }>(`/api/v1/folders/${folderId}/decks`, {
    method: "POST",
    body: JSON.stringify({ deckId }),
  });
}

export function removeDeckFromFolder(
  folderId: string,
  deckId: string
): Promise<{ removed: boolean }> {
  return authed<{ removed: boolean }>(
    `/api/v1/folders/${folderId}/decks?deckId=${encodeURIComponent(deckId)}`,
    { method: "DELETE" }
  );
}

/**
 * Reihenfolge der Decks im Ordner speichern (#437). `deckIds` ist die
 * komplette gewünschte Reihenfolge, vorne = oben.
 */
export function setFolderDeckOrder(
  folderId: string,
  deckIds: string[]
): Promise<{ reordered: boolean }> {
  return authed<{ reordered: boolean }>(`/api/v1/folders/${folderId}/decks`, {
    method: "PUT",
    body: JSON.stringify({ deckIds }),
  });
}
