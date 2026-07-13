/**
 * Route-level tests for GET /api/v1/stats (Statistik-Ausbau C+D).
 *
 * The `days` query parameter is whitelisted to exactly 7 or 30 — anything
 * else (missing, 999, garbage) falls back to 7. The response must stay
 * backward-compatible: every pre-existing field is still present, and the
 * new `durationMsByDay` rides along for the per-day "Lernzeit" detail.
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

import { GET } from "../../app/api/v1/stats/route";
import { getAuthUser } from "@/lib/auth";
import { getStreakInfo, getReviewStats, getLastStudiedDeck } from "@/lib/db";
import { listDecksForUser } from "@/services/deckService";
import { getDueCards } from "@/services/learnService";

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedGetStreakInfo = vi.mocked(getStreakInfo);
const mockedGetReviewStats = vi.mocked(getReviewStats);
const mockedGetLastStudiedDeck = vi.mocked(getLastStudiedDeck);
const mockedListDecksForUser = vi.mocked(listDecksForUser);
const mockedGetDueCards = vi.mocked(getDueCards);

const AUTH_USER_ID = "11111111-1111-4111-8111-111111111111";

const REVIEW_STATS = {
  reviewsToday: 3,
  reviewsThisWeek: 12,
  reviewsTotal: 200,
  accuracyRate: 0.85,
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
      dailyGoal: 10,
    });
    mockedGetReviewStats.mockResolvedValue(REVIEW_STATS);
    mockedGetLastStudiedDeck.mockResolvedValue({ id: "deck-1", title: "Bio" });
  });

  it("defaults to a 7-day window without a days param", async () => {
    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    expect(mockedGetReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, 7);
  });

  it("passes days=30 through to getReviewStats", async () => {
    const response = await GET(getRequest("30"));

    expect(response.status).toBe(200);
    expect(mockedGetReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, 30);
  });

  it("treats a non-whitelisted value (?days=999) like 7", async () => {
    await GET(getRequest("999"));

    expect(mockedGetReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, 7);
  });

  it("treats a garbage value (?days=abc) like 7", async () => {
    await GET(getRequest("abc"));

    expect(mockedGetReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, 7);
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
      dailyGoal: 10,
      reviewsToday: 3,
      reviewsThisWeek: 12,
      reviewsTotal: 200,
      accuracyRate: 0.85,
      reviewsByDay: REVIEW_STATS.reviewsByDay,
      accuracyByDay: REVIEW_STATS.accuracyByDay,
      lastStudiedDeck: { id: "deck-1", title: "Bio" },
    });
  });

  it("returns 401 without a valid token", async () => {
    mockedGetAuthUser.mockResolvedValue(null);

    const response = await GET(getRequest("30"));

    expect(response.status).toBe(401);
    expect(mockedGetReviewStats).not.toHaveBeenCalled();
  });
});
