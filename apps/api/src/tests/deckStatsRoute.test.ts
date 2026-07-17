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
 *     Pro-only ("Deck-Vergleich"): free users get 403/PRO_REQUIRED — 403, not
 *     402/PAYWALL_REQUIRED, because shipped app builds auto-open the paywall
 *     on 402 and this is a passive view.
 *
 * #235: the 30-day history is a Pro ("advanced statistics") feature on the
 * per-deck route: free users keep their deck statistics but are clamped to the
 * 7-day window. The whitelist tests below run as a Pro user so the `days`
 * logic is exercised in isolation; dedicated blocks cover both tiers.
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
vi.mock("@/services/subscriptionService", () => ({ getSubscriptionStatus: vi.fn() }));

import { GET as getDeckStatsRoute } from "../../app/api/v1/decks/[id]/stats/route";
import { GET as getDeckSummariesRoute } from "../../app/api/v1/stats/decks/route";
import { getAuthUser } from "@/lib/auth";
import {
  getDeck,
  getDeckReviewStats,
  getDeckWobblyCards,
  getDeckReviewSummaries,
} from "@/lib/db";
import { getSubscriptionStatus } from "@/services/subscriptionService";

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedGetDeck = vi.mocked(getDeck);
const mockedGetDeckReviewStats = vi.mocked(getDeckReviewStats);
const mockedGetDeckWobblyCards = vi.mocked(getDeckWobblyCards);
const mockedGetDeckReviewSummaries = vi.mocked(getDeckReviewSummaries);
const mockedGetSubscriptionStatus = vi.mocked(getSubscriptionStatus);

const AUTH_USER_ID = "11111111-1111-4111-8111-111111111111";
const DECK_ID = "22222222-2222-4222-8222-222222222222";

// The tier always comes from the server-side subscription lookup, never from
// the request — mirrors statsRoute.test.ts.
function mockTier(tier: "free" | "pro" | "lifetime") {
  mockedGetSubscriptionStatus.mockResolvedValue({
    userId: AUTH_USER_ID,
    tier,
    isActive: tier !== "free",
    expiresAt: null,
  } as never);
}

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

// One trend point per day of the requested window — lets a test assert the
// window the route really used by the length of the series it hands back.
function seriesOfLength(days: number) {
  return Array.from({ length: days }, (_unused, index) => ({
    date: `2026-07-${String(index + 1).padStart(2, "0")}`,
    accuracy: 0.8,
    count: 3,
  }));
}

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
    // Whitelist behaviour is about the `days` logic, not the tier — run it as
    // Pro so the 30-day window is not clamped away (#235).
    mockTier("pro");
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
    mockTier("pro");
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

describe("GET /api/v1/decks/:id/stats – advanced-stats gate (#235)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockResolvedValue({
      userId: AUTH_USER_ID,
      email: "lara@example.com",
    });
    mockedGetDeck.mockResolvedValue(DECK);
    mockedGetDeckWobblyCards.mockResolvedValue(WOBBLY_CARDS);
    // The trend series length follows the window the route actually queried, so
    // the assertions below prove the clamp reaches the data, not just the call.
    mockedGetDeckReviewStats.mockImplementation(
      async (_userId: string, _deckId: string, days = 30) => ({
        answersTotal: 40,
        answersCorrect: 28,
        accuracyByDay: seriesOfLength(days),
      }),
    );
  });

  it("clamps a free user's ?days=30 down to the basic 7-day window", async () => {
    mockTier("free");

    const response = await getDeckStatsRoute(deckStatsRequest("30"), deckParams());
    const body = (await response.json()) as { accuracyByDay: unknown[] };

    expect(response.status).toBe(200);
    expect(mockedGetDeckReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, DECK_ID, 7);
    expect(body.accuracyByDay).toHaveLength(7);
  });

  it("clamps a free user with no days param to 7 days (not the historic 30)", async () => {
    mockTier("free");

    await getDeckStatsRoute(deckStatsRequest(), deckParams());

    expect(mockedGetDeckReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, DECK_ID, 7);
  });

  it("leaves a free user's ?days=7 at 7 (nothing to clamp)", async () => {
    mockTier("free");

    const response = await getDeckStatsRoute(deckStatsRequest("7"), deckParams());

    expect(response.status).toBe(200);
    expect(mockedGetDeckReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, DECK_ID, 7);
  });

  it("clamps a free user's non-whitelisted ?days=999 to 7 as well", async () => {
    mockTier("free");

    await getDeckStatsRoute(deckStatsRequest("999"), deckParams());

    expect(mockedGetDeckReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, DECK_ID, 7);
  });

  it("keeps a pro user's ?days=30 at the full 30-day window", async () => {
    mockTier("pro");

    const response = await getDeckStatsRoute(deckStatsRequest("30"), deckParams());
    const body = (await response.json()) as { accuracyByDay: unknown[] };

    expect(response.status).toBe(200);
    expect(mockedGetDeckReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, DECK_ID, 30);
    expect(body.accuracyByDay).toHaveLength(30);
  });

  it("treats lifetime like pro (advancedStats: true)", async () => {
    mockTier("lifetime");

    await getDeckStatsRoute(deckStatsRequest("30"), deckParams());

    expect(mockedGetDeckReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, DECK_ID, 30);
  });

  it("clamps rather than rejects: a free user still gets their deck stats", async () => {
    mockTier("free");

    const response = await getDeckStatsRoute(deckStatsRequest("30"), deckParams());
    const body = (await response.json()) as Record<string, unknown>;

    // No 402/PAYWALL_REQUIRED — the documented design is clamp, not reject.
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      deck: { id: DECK_ID, title: "Bio Zellatmung" },
      answersTotal: 40,
      answersCorrect: 28,
      wobblyCards: WOBBLY_CARDS,
    });
  });

  it("never takes the tier from the request (client cannot claim pro)", async () => {
    mockTier("free");

    // A crafted request that tries to pass itself off as Pro every way it can.
    const spoofed = new Request(
      `http://localhost/api/v1/decks/${DECK_ID}/stats?days=30&tier=pro`,
      { method: "GET", headers: { "x-subscription-tier": "pro" } },
    ) as never;
    await getDeckStatsRoute(spoofed, deckParams());

    // Tier came from getSubscriptionStatus(userId) alone → still clamped.
    expect(mockedGetSubscriptionStatus).toHaveBeenCalledWith(AUTH_USER_ID);
    expect(mockedGetDeckReviewStats).toHaveBeenCalledWith(AUTH_USER_ID, DECK_ID, 7);
  });
});

describe("GET /api/v1/stats/decks – Pro-Gate (Deck-Vergleich)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockResolvedValue({
      userId: AUTH_USER_ID,
      email: "lara@example.com",
    });
    mockedGetDeckReviewSummaries.mockResolvedValue(SUMMARIES);
  });

  it("rejects a free user with 403 PRO_REQUIRED and queries nothing", async () => {
    mockTier("free");

    const response = await getDeckSummariesRoute(summariesRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(403);
    expect(body.code).toBe("PRO_REQUIRED");
    expect(mockedGetDeckReviewSummaries).not.toHaveBeenCalled();
  });

  it("does not use 402/PAYWALL_REQUIRED — shipped apps auto-open the paywall on 402", async () => {
    mockTier("free");

    const response = await getDeckSummariesRoute(summariesRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).not.toBe(402);
    expect(body.code).not.toBe("PAYWALL_REQUIRED");
  });

  it("keeps the full 30-day window for a pro user", async () => {
    mockTier("pro");

    const response = await getDeckSummariesRoute(summariesRequest());

    expect(response.status).toBe(200);
    expect(mockedGetDeckReviewSummaries).toHaveBeenCalledWith(AUTH_USER_ID, 30);
  });

  it("treats lifetime like pro (advancedStats: true)", async () => {
    mockTier("lifetime");

    await getDeckSummariesRoute(summariesRequest());

    expect(mockedGetDeckReviewSummaries).toHaveBeenCalledWith(AUTH_USER_ID, 30);
  });

  it("resolves the tier server-side from the authenticated user id", async () => {
    mockTier("free");

    await getDeckSummariesRoute(summariesRequest());

    expect(mockedGetSubscriptionStatus).toHaveBeenCalledWith(AUTH_USER_ID);
    expect(mockedGetDeckReviewSummaries).not.toHaveBeenCalled();
  });
});
