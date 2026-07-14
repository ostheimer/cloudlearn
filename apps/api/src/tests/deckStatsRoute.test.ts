/**
 * Route-level tests for the per-deck statistics endpoints (#246):
 *
 *   GET /api/v1/decks/:id/stats  — one deck: totals, trend, Wackelkandidaten.
 *     Ownership gate: the deck is fetched by id AND user_id (admin client
 *     bypasses RLS) — a foreign or missing deck yields 404 DECK_NOT_FOUND and
 *     no stats query ever runs.
 *
 *   GET /api/v1/stats/decks — per-deck summaries for ALL of the user's decks
 *     in one call (decks without answers included with answersTotal 0).
 *
 * `@/lib/http` is mocked with light Response-shaped fakes so the test never
 * has to load `next/server` (same pattern as statsRoute.test.ts).
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
  createRequestContext: () => ({ requestId: "req-deck-stats-1" }),
}));
vi.mock("@/lib/db", () => ({
  getDeck: vi.fn(),
  getDeckReviewStats: vi.fn(),
  getDeckWobblyCards: vi.fn(),
  getDeckReviewSummaries: vi.fn(),
}));

import { GET as getDeckStatsRoute } from "../../app/api/v1/decks/[id]/stats/route";
import { GET as getDeckSummariesRoute } from "../../app/api/v1/stats/decks/route";
import { getAuthUser } from "@/lib/auth";
import {
  getDeck,
  getDeckReviewStats,
  getDeckWobblyCards,
  getDeckReviewSummaries,
} from "@/lib/db";

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedGetDeck = vi.mocked(getDeck);
const mockedGetDeckReviewStats = vi.mocked(getDeckReviewStats);
const mockedGetDeckWobblyCards = vi.mocked(getDeckWobblyCards);
const mockedGetDeckReviewSummaries = vi.mocked(getDeckReviewSummaries);

const AUTH_USER_ID = "11111111-1111-4111-8111-111111111111";
const DECK_ID = "22222222-2222-4222-8222-222222222222";

const DECK = {
  id: DECK_ID,
  userId: AUTH_USER_ID,
  title: "Bio Zellatmung",
  tags: [],
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
} as never;

const DECK_REVIEW_STATS = {
  answersTotal: 40,
  answersCorrect: 28,
  accuracyByDay: [
    { date: "2026-07-12", accuracy: 0.5, count: 10 },
    { date: "2026-07-13", accuracy: 0.8, count: 30 },
  ],
};

const WOBBLY_CARDS = [
  {
    cardId: "c-1",
    front: "Mitochondrium",
    back: "Kraftwerk der Zelle",
    wrongCount: 4,
    lastWrongAt: "2026-07-13T09:00:00.000Z",
  },
  {
    cardId: "c-2",
    front: "Ribosom",
    back: "Ort der Proteinbiosynthese",
    wrongCount: 2,
    lastWrongAt: "2026-07-12T09:00:00.000Z",
  },
];

const SUMMARIES = [
  { deckId: DECK_ID, title: "Bio Zellatmung", answersTotal: 40, accuracyRate: 0.7 },
  { deckId: "33333333-3333-4333-8333-333333333333", title: "Latein", answersTotal: 0, accuracyRate: 0 },
];

function deckStatsRequest(days?: string) {
  const query = days === undefined ? "" : `?days=${encodeURIComponent(days)}`;
  return new Request(`http://localhost/api/v1/decks/${DECK_ID}/stats${query}`, {
    method: "GET",
  }) as never;
}

function summariesRequest() {
  return new Request("http://localhost/api/v1/stats/decks", { method: "GET" }) as never;
}

function deckParams(id: string = DECK_ID) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/v1/decks/:id/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockResolvedValue({
      userId: AUTH_USER_ID,
      email: "lara@example.com",
    });
    mockedGetDeck.mockResolvedValue(DECK);
    mockedGetDeckReviewStats.mockResolvedValue(DECK_REVIEW_STATS);
    mockedGetDeckWobblyCards.mockResolvedValue(WOBBLY_CARDS);
  });

  it("returns 401 without a valid token and queries nothing", async () => {
    mockedGetAuthUser.mockResolvedValue(null);

    const response = await getDeckStatsRoute(deckStatsRequest(), deckParams());

    expect(response.status).toBe(401);
    expect(mockedGetDeck).not.toHaveBeenCalled();
    expect(mockedGetDeckReviewStats).not.toHaveBeenCalled();
  });

  it("verifies ownership by fetching the deck with id AND user_id", async () => {
    await getDeckStatsRoute(deckStatsRequest(), deckParams());

    expect(mockedGetDeck).toHaveBeenCalledWith(DECK_ID, AUTH_USER_ID);
  });

  it("returns 404 DECK_NOT_FOUND for a foreign/missing deck without querying stats", async () => {
    mockedGetDeck.mockResolvedValue(null); // not found under this user_id

    const response = await getDeckStatsRoute(deckStatsRequest(), deckParams());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(404);
    expect(body.code).toBe("DECK_NOT_FOUND");
    expect(mockedGetDeckReviewStats).not.toHaveBeenCalled();
    expect(mockedGetDeckWobblyCards).not.toHaveBeenCalled();
  });

  it("returns deck, totals, trend and wobbly cards for the owner", async () => {
    const response = await getDeckStatsRoute(deckStatsRequest(), deckParams());
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      deck: { id: DECK_ID, title: "Bio Zellatmung" },
      answersTotal: 40,
      answersCorrect: 28,
      accuracyByDay: DECK_REVIEW_STATS.accuracyByDay,
      wobblyCards: WOBBLY_CARDS,
    });
    expect(mockedGetDeckReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, DECK_ID, 30);
    expect(mockedGetDeckWobblyCards).toHaveBeenCalledWith(AUTH_USER_ID, DECK_ID, 5);
  });

  it("defaults to the 30-day window without a days param (old clients)", async () => {
    await getDeckStatsRoute(deckStatsRequest(), deckParams());

    expect(mockedGetDeckReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, DECK_ID, 30);
  });

  it("passes ?days=7 through to getDeckReviewStats", async () => {
    await getDeckStatsRoute(deckStatsRequest("7"), deckParams());

    expect(mockedGetDeckReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, DECK_ID, 7);
  });

  it("passes ?days=30 through to getDeckReviewStats", async () => {
    await getDeckStatsRoute(deckStatsRequest("30"), deckParams());

    expect(mockedGetDeckReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, DECK_ID, 30);
  });

  it("treats a non-whitelisted value (?days=999) like 30", async () => {
    await getDeckStatsRoute(deckStatsRequest("999"), deckParams());

    expect(mockedGetDeckReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, DECK_ID, 30);
  });

  it("treats a garbage value (?days=abc) like 30", async () => {
    await getDeckStatsRoute(deckStatsRequest("abc"), deckParams());

    expect(mockedGetDeckReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, DECK_ID, 30);
  });

  it("keeps the Wackelkandidaten all-time (limit 5) regardless of days", async () => {
    await getDeckStatsRoute(deckStatsRequest("7"), deckParams());

    expect(mockedGetDeckWobblyCards).toHaveBeenCalledWith(AUTH_USER_ID, DECK_ID, 5);
  });
});

describe("GET /api/v1/stats/decks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockResolvedValue({
      userId: AUTH_USER_ID,
      email: "lara@example.com",
    });
    mockedGetDeckReviewSummaries.mockResolvedValue(SUMMARIES);
  });

  it("returns 401 without a valid token and queries nothing", async () => {
    mockedGetAuthUser.mockResolvedValue(null);

    const response = await getDeckSummariesRoute(summariesRequest());

    expect(response.status).toBe(401);
    expect(mockedGetDeckReviewSummaries).not.toHaveBeenCalled();
  });

  it("returns the 30-day per-deck summaries, including zero-answer decks", async () => {
    const response = await getDeckSummariesRoute(summariesRequest());
    const body = (await response.json()) as { decks: unknown };

    expect(response.status).toBe(200);
    expect(body.decks).toEqual(SUMMARIES);
    expect(mockedGetDeckReviewSummaries).toHaveBeenCalledWith(AUTH_USER_ID, 30);
  });
});
