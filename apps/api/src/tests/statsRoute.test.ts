/**
 * Route-level tests for GET /api/v1/stats (Statistik-Ausbau C+D).
 *
 * The `days` query parameter is whitelisted to exactly 7 or 30 — anything
 * else (missing, 999, garbage) falls back to 30, the historic window from
 * before the param existed, so old clients without `?days=` keep their full
 * 30-day series. The response must stay backward-compatible: every
 * pre-existing field is still present, and the new `durationMsByDay` rides
 * along for the per-day "Lernzeit" detail.
 *
 * #235: the 30-day history is a Pro ("advanced statistics") feature. Free
 * users keep the full basic stats but are clamped to the 7-day window. The
 * whitelist tests below run as a Pro user so the `days` logic is exercised in
 * isolation; a dedicated block covers the free-tier clamp.
 *
 * `@/lib/http` is mocked with light Response-shaped fakes so the test never
 * has to load `next/server`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/http", () => ({
  jsonOk: (_requestId: string, data: unknown, status = 200) => ({
    status,
    json: async () => data,
  }),
  jsonError: (requestId: string, code: string, message: string, status = 400) => ({
    status,
    json: async () => ({ code, message, request_id: requestId }),
  }),
  normalizeError: (error: unknown) => ({
    code: "INTERNAL_ERROR",
    message: error instanceof Error ? error.message : "Unknown error",
    status: 500,
  }),
}));
vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/observability", () => ({
  createRequestContext: () => ({ requestId: "req-stats-1" }),
}));
vi.mock("@/lib/db", () => ({
  getStreakInfo: vi.fn(),
  getReviewStats: vi.fn(),
  getLastStudiedDeck: vi.fn(),
}));
vi.mock("@/services/deckService", () => ({ listDecksForUser: vi.fn() }));
vi.mock("@/services/learnService", () => ({ getDueCards: vi.fn() }));
vi.mock("@/services/subscriptionService", () => ({ getSubscriptionStatus: vi.fn() }));

import { GET } from "../../app/api/v1/stats/route";
import { getAuthUser } from "@/lib/auth";
import { getStreakInfo, getReviewStats, getLastStudiedDeck } from "@/lib/db";
import { listDecksForUser } from "@/services/deckService";
import { getDueCards } from "@/services/learnService";
import { getSubscriptionStatus } from "@/services/subscriptionService";

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedGetStreakInfo = vi.mocked(getStreakInfo);
const mockedGetReviewStats = vi.mocked(getReviewStats);
const mockedGetLastStudiedDeck = vi.mocked(getLastStudiedDeck);
const mockedListDecksForUser = vi.mocked(listDecksForUser);
const mockedGetDueCards = vi.mocked(getDueCards);
const mockedGetSubscriptionStatus = vi.mocked(getSubscriptionStatus);

function mockTier(tier: "free" | "pro" | "lifetime") {
  mockedGetSubscriptionStatus.mockResolvedValue({
    userId: AUTH_USER_ID,
    tier,
    isActive: tier !== "free",
    expiresAt: null,
  } as never);
}

const AUTH_USER_ID = "11111111-1111-4111-8111-111111111111";

const REVIEW_STATS = {
  reviewsToday: 3,
  reviewsThisWeek: 12,
  // All-time, unlike the two below: they belong to the requested window.
  reviewsTotal: 200,
  reviewsInWindow: 80,
  accuracyRate: 0.85,
  // Bewusst verschiedene Werte, und ihre Summe (60) liegt unter
  // reviewsInWindow: Prüfungen zählen in keiner der beiden Gruppen mit, die
  // Gruppen müssen sich also NICHT zum Fenster addieren.
  accuracyByKind: {
    recall: { rate: 0.52, answers: 40 },
    recognition: { rate: 0.91, answers: 20 },
  },
  reviewsByDay: [{ date: "2026-07-13", count: 3 }],
  accuracyByDay: [{ date: "2026-07-13", accuracy: 0.67, count: 3 }],
  durationMsByDay: [{ date: "2026-07-13", durationMs: 120000 }],
};

function getRequest(days?: string) {
  const url = `http://localhost/api/v1/stats${
    days === undefined ? "" : `?days=${encodeURIComponent(days)}`
  }`;
  return new Request(url, { method: "GET" }) as never;
}

describe("GET /api/v1/stats – days whitelist + durationMsByDay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockResolvedValue({
      userId: AUTH_USER_ID,
      email: "lara@example.com",
    });
    mockedListDecksForUser.mockResolvedValue([] as never);
    mockedGetDueCards.mockResolvedValue([] as never);
    mockedGetStreakInfo.mockResolvedValue({
      currentStreak: 4,
      longestStreak: 9,
      lastReviewDate: "2026-07-13",
      dailyGoal: 30,
      streakFreezes: 0,
      repairAvailable: false,
      repairBrokenStreak: 0,
      repairCost: 40,
    });
    mockedGetReviewStats.mockResolvedValue(REVIEW_STATS);
    mockedGetLastStudiedDeck.mockResolvedValue({
      id: "deck-1",
      title: "Bio",
      reviewedAt: "2026-07-20T12:44:00.000Z",
    });
    // Whitelist behaviour is about the `days` logic, not the tier — run it as
    // Pro so the 30-day window is not clamped away (#235).
    mockTier("pro");
  });

  it("defaults to the historic 30-day window without a days param (old clients)", async () => {
    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    expect(mockedGetReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, 30);
  });

  it("passes days=7 through to getReviewStats", async () => {
    const response = await GET(getRequest("7"));

    expect(response.status).toBe(200);
    expect(mockedGetReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, 7);
  });

  it("passes days=30 through to getReviewStats", async () => {
    const response = await GET(getRequest("30"));

    expect(response.status).toBe(200);
    expect(mockedGetReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, 30);
  });

  it("treats a non-whitelisted value (?days=999) like 30", async () => {
    await GET(getRequest("999"));

    expect(mockedGetReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, 30);
  });

  it("treats a garbage value (?days=abc) like 30", async () => {
    await GET(getRequest("abc"));

    expect(mockedGetReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, 30);
  });

  it("keeps all existing fields and adds durationMsByDay to the response", async () => {
    const response = await GET(getRequest("30"));
    const body = (await response.json()) as {
      stats: Record<string, unknown>;
    };

    // New field for the per-day "Lernzeit" detail
    expect(body.stats.durationMsByDay).toEqual(REVIEW_STATS.durationMsByDay);

    // Backward-compatible: everything mobile Home / web dashboard already read
    expect(body.stats).toMatchObject({
      totalDecks: 0,
      dueCards: 0,
      currentStreak: 4,
      longestStreak: 9,
      lastReviewDate: "2026-07-13",
      dailyGoal: 30,
      reviewsToday: 3,
      reviewsThisWeek: 12,
      reviewsTotal: 200,
      accuracyRate: 0.85,
      reviewsByDay: REVIEW_STATS.reviewsByDay,
      accuracyByDay: REVIEW_STATS.accuracyByDay,
      // The timestamp ships along so clients can compare it against their own
      // local "last opened" marker and show whichever is newer (#415).
      lastStudiedDeck: { id: "deck-1", title: "Bio", reviewedAt: "2026-07-20T12:44:00.000Z" },
    });
  });

  it("tells clients which window the accuracy covers, and how many answers back it", async () => {
    const response = await GET(getRequest("30"));
    const body = (await response.json()) as { stats: Record<string, unknown> };

    // Without these two, a client can't caption "Genauigkeit" honestly: it
    // can't name the window, and it can't tell "nothing answered lately"
    // (dash) from "answered, all wrong" (0 %).
    expect(body.stats.reviewsInWindow).toBe(80);
    expect(body.stats.statsWindowDays).toBe(30);
  });

  it("passes the accuracy split by kind through to the client", async () => {
    const response = await GET(getRequest("30"));
    const body = (await response.json()) as { stats: Record<string, unknown> };

    // Die Route reicht nur durch — gerechnet wird in getReviewStats. Der Test
    // schützt trotzdem: fiele das Feld beim Zusammenbauen der Antwort heraus,
    // zeigte der Client stillschweigend gar keine Aufteilung mehr, statt zu
    // scheitern (das Feld ist clientseitig optional, wegen alter API-Stände).
    expect(body.stats.accuracyByKind).toEqual({
      recall: { rate: 0.52, answers: 40 },
      recognition: { rate: 0.91, answers: 20 },
    });
  });

  it("reports the window a Free account actually got, not the one it asked for", async () => {
    mockTier("free");

    const response = await GET(getRequest("30"));
    const body = (await response.json()) as { stats: Record<string, unknown> };

    // The tier clamp serves 7 days of data (#235). Echoing the requested 30
    // would put a week's numbers under a "letzte 30 Tage" caption.
    expect(body.stats.statsWindowDays).toBe(7);
  });

  it("returns 401 without a valid token", async () => {
    mockedGetAuthUser.mockResolvedValue(null);

    const response = await GET(getRequest("30"));

    expect(response.status).toBe(401);
    expect(mockedGetReviewStats).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/stats – advanced-stats gate for free users (#235)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockResolvedValue({
      userId: AUTH_USER_ID,
      email: "lara@example.com",
    });
    mockedListDecksForUser.mockResolvedValue([] as never);
    mockedGetDueCards.mockResolvedValue([] as never);
    mockedGetStreakInfo.mockResolvedValue({
      currentStreak: 4,
      longestStreak: 9,
      lastReviewDate: "2026-07-13",
      dailyGoal: 30,
      streakFreezes: 0,
      repairAvailable: false,
      repairBrokenStreak: 0,
      repairCost: 40,
    });
    mockedGetReviewStats.mockResolvedValue(REVIEW_STATS);
    mockedGetLastStudiedDeck.mockResolvedValue({
      id: "deck-1",
      title: "Bio",
      reviewedAt: "2026-07-20T12:44:00.000Z",
    });
  });

  it("clamps a free user's 30-day request down to the basic 7-day window", async () => {
    mockTier("free");

    const response = await GET(getRequest("30"));

    expect(response.status).toBe(200);
    expect(mockedGetReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, 7);
  });

  it("clamps a free user with no days param to 7 days (not the historic 30)", async () => {
    mockTier("free");

    await GET(getRequest());

    expect(mockedGetReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, 7);
  });

  it("still returns the full basic stats to a free user (tab keeps working)", async () => {
    mockTier("free");

    const response = await GET(getRequest("7"));
    const body = (await response.json()) as { stats: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(body.stats).toMatchObject({
      currentStreak: 4,
      reviewsToday: 3,
      accuracyRate: 0.85,
    });
  });
});
