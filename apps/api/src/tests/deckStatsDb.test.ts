/**
 * Tests for the per-deck stats helpers (#246): getDeckReviewStats,
 * getDeckWobblyCards and getDeckReviewSummaries.
 *
 * "Correct" mirrors getReviewStats' accuracy definition (rating >= 3, i.e.
 * good/easy); again (1) and hard (2) are wrong. Wackelkandidaten are ordered
 * by wrong count (desc), ties by the most recent wrong answer, capped at
 * `limit`.
 *
 * The Supabase admin client is replaced with a thenable query-builder fake
 * (same pattern as reviewStatsDb.test.ts): every chained method returns the
 * builder itself, awaiting it resolves the next queued response.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));

import {
  getDeckReviewStats,
  getDeckWobblyCards,
  getDeckReviewSummaries,
} from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase";

const mockedCreateDb = vi.mocked(createSupabaseAdminClient);

const USER_ID = "11111111-1111-4111-8111-111111111111";
const DECK_ID = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-07-13T12:00:00.000Z");

type QueryResponse = { count?: number | null; data?: unknown; error: null };

interface RecordedCall {
  method: string;
  args: unknown[];
}

function makeDbMock(responses: QueryResponse[]) {
  const queue = [...responses];
  const calls: RecordedCall[] = [];

  const from = vi.fn().mockImplementation((table: string) => {
    calls.push({ method: "from", args: [table] });
    const response = queue.shift() ?? { count: 0, data: [], error: null };
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "neq", "gte", "lt", "is", "order", "limit"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return builder;
      };
    }
    // Awaiting the builder resolves this query's response.
    builder.then = (
      onFulfilled: (value: QueryResponse) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(response).then(onFulfilled, onRejected);
    return builder;
  });

  return { db: { from } as never, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getDeckReviewStats – totals + accuracy trend for one deck", () => {
  const ROWS = [
    // 2026-07-12: 1 good, 1 again → 50 %
    { rating: 4, reviewed_at: "2026-07-12T08:00:00.000Z", cards: { deck_id: DECK_ID } },
    { rating: 1, reviewed_at: "2026-07-12T09:00:00.000Z", cards: { deck_id: DECK_ID } },
    // 2026-07-13: 2 good, 1 hard (hard counts as wrong) → 0.67
    { rating: 3, reviewed_at: "2026-07-13T10:00:00.000Z", cards: { deck_id: DECK_ID } },
    { rating: 3, reviewed_at: "2026-07-13T10:05:00.000Z", cards: { deck_id: DECK_ID } },
    { rating: 2, reviewed_at: "2026-07-13T10:10:00.000Z", cards: { deck_id: DECK_ID } },
  ];

  it("counts totals with rating >= 3 as correct (hard is wrong)", async () => {
    const { db } = makeDbMock([{ data: ROWS, error: null }]);
    mockedCreateDb.mockReturnValue(db);

    const stats = await getDeckReviewStats(USER_ID, DECK_ID, 30);

    expect(stats.answersTotal).toBe(5);
    expect(stats.answersCorrect).toBe(3);
  });

  it("keeps accuracyByDay limited to days with reviews", async () => {
    const { db } = makeDbMock([{ data: ROWS, error: null }]);
    mockedCreateDb.mockReturnValue(db);

    const stats = await getDeckReviewStats(USER_ID, DECK_ID, 30);

    expect(stats.accuracyByDay).toEqual([
      { date: "2026-07-12", count: 2, accuracy: 0.5 },
      { date: "2026-07-13", count: 3, accuracy: 0.67 },
    ]);
  });

  it("scopes the query to the user, the deck (via cards join) and the window", async () => {
    const { db, calls } = makeDbMock([{ data: [], error: null }]);
    mockedCreateDb.mockReturnValue(db);

    await getDeckReviewStats(USER_ID, DECK_ID, 7);

    expect(calls.find((c) => c.method === "from")?.args).toEqual(["review_logs"]);
    const eqCalls = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqCalls).toContainEqual(["user_id", USER_ID]);
    expect(eqCalls).toContainEqual(["cards.deck_id", DECK_ID]);
    expect(calls.find((c) => c.method === "gte")?.args).toEqual([
      "reviewed_at",
      "2026-07-07T00:00:00.000Z",
    ]);
  });

  it("returns zeros and an empty trend for a deck without answers", async () => {
    const { db } = makeDbMock([{ data: [], error: null }]);
    mockedCreateDb.mockReturnValue(db);

    const stats = await getDeckReviewStats(USER_ID, DECK_ID, 30);

    expect(stats).toEqual({ answersTotal: 0, answersCorrect: 0, accuracyByDay: [] });
  });
});

describe("getDeckWobblyCards – most-wrong cards, ordered", () => {
  const card = (id: string, front: string) => ({
    deck_id: DECK_ID,
    front,
    back: `Antwort ${front}`,
    deleted_at: null,
  });

  // Wrong answers only (the query filters rating < 3):
  // c-3 → 3x wrong, c-2 → 2x wrong (latest 07-11), c-tie → 2x wrong (latest
  // 07-12, so it wins the tie), c-1 → 1x wrong.
  const WRONG_ROWS = [
    { card_id: "c-3", reviewed_at: "2026-07-10T08:00:00.000Z", cards: card("c-3", "Osmose") },
    { card_id: "c-3", reviewed_at: "2026-07-11T08:00:00.000Z", cards: card("c-3", "Osmose") },
    { card_id: "c-3", reviewed_at: "2026-07-12T08:00:00.000Z", cards: card("c-3", "Osmose") },
    { card_id: "c-2", reviewed_at: "2026-07-10T09:00:00.000Z", cards: card("c-2", "Diffusion") },
    { card_id: "c-2", reviewed_at: "2026-07-11T09:00:00.000Z", cards: card("c-2", "Diffusion") },
    { card_id: "c-tie", reviewed_at: "2026-07-11T10:00:00.000Z", cards: card("c-tie", "Enzym") },
    { card_id: "c-tie", reviewed_at: "2026-07-12T10:00:00.000Z", cards: card("c-tie", "Enzym") },
    { card_id: "c-1", reviewed_at: "2026-07-13T07:00:00.000Z", cards: card("c-1", "Zellkern") },
  ];

  it("orders by wrong count desc, ties by most recent wrong answer", async () => {
    const { db } = makeDbMock([{ data: WRONG_ROWS, error: null }]);
    mockedCreateDb.mockReturnValue(db);

    const wobbly = await getDeckWobblyCards(USER_ID, DECK_ID, 5);

    expect(wobbly.map((w) => w.cardId)).toEqual(["c-3", "c-tie", "c-2", "c-1"]);
    expect(wobbly[0]).toEqual({
      cardId: "c-3",
      front: "Osmose",
      back: "Antwort Osmose",
      wrongCount: 3,
      lastWrongAt: "2026-07-12T08:00:00.000Z",
    });
  });

  it("caps the list at `limit`", async () => {
    const manyRows = ["a", "b", "c", "d", "e", "f", "g"].map((id, i) => ({
      card_id: `card-${id}`,
      reviewed_at: `2026-07-0${i + 1}T08:00:00.000Z`,
      cards: card(`card-${id}`, `Front ${id}`),
    }));
    const { db } = makeDbMock([{ data: manyRows, error: null }]);
    mockedCreateDb.mockReturnValue(db);

    const wobbly = await getDeckWobblyCards(USER_ID, DECK_ID, 5);

    expect(wobbly).toHaveLength(5);
  });

  it("queries only wrong ratings (< 3) of non-deleted cards in this deck", async () => {
    const { db, calls } = makeDbMock([{ data: [], error: null }]);
    mockedCreateDb.mockReturnValue(db);

    await getDeckWobblyCards(USER_ID, DECK_ID, 5);

    expect(calls.find((c) => c.method === "lt")?.args).toEqual(["rating", 3]);
    expect(calls.find((c) => c.method === "is")?.args).toEqual([
      "cards.deleted_at",
      null,
    ]);
    const eqCalls = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqCalls).toContainEqual(["user_id", USER_ID]);
    expect(eqCalls).toContainEqual(["cards.deck_id", DECK_ID]);
  });

  it("skips occlusion cards — they cannot be practised as flashcards", async () => {
    const { db, calls } = makeDbMock([{ data: [], error: null }]);
    mockedCreateDb.mockReturnValue(db);

    await getDeckWobblyCards(USER_ID, DECK_ID, 5);

    expect(calls.find((c) => c.method === "neq")?.args).toEqual([
      "cards.card_type",
      "occlusion",
    ]);
  });
});

describe("getDeckReviewSummaries – all decks in two queries", () => {
  const DECKS = [
    { id: "deck-a", title: "Bio" },
    { id: "deck-b", title: "Latein" },
  ];
  // Only deck-a has answers in the window: 3 good out of 4.
  const LOGS = [
    { rating: 4, cards: { deck_id: "deck-a" } },
    { rating: 3, cards: { deck_id: "deck-a" } },
    { rating: 3, cards: { deck_id: "deck-a" } },
    { rating: 1, cards: { deck_id: "deck-a" } },
  ];

  it("includes zero-answer decks with answersTotal 0 (LEFT-join style)", async () => {
    const { db } = makeDbMock([
      { data: DECKS, error: null },
      { data: LOGS, error: null },
    ]);
    mockedCreateDb.mockReturnValue(db);

    const summaries = await getDeckReviewSummaries(USER_ID, 30);

    expect(summaries).toEqual([
      { deckId: "deck-a", title: "Bio", answersTotal: 4, accuracyRate: 0.75 },
      { deckId: "deck-b", title: "Latein", answersTotal: 0, accuracyRate: 0 },
    ]);
  });

  it("issues exactly two queries: decks, then windowed review logs", async () => {
    const { db, calls } = makeDbMock([
      { data: DECKS, error: null },
      { data: LOGS, error: null },
    ]);
    mockedCreateDb.mockReturnValue(db);

    await getDeckReviewSummaries(USER_ID, 30);

    const fromCalls = calls.filter((c) => c.method === "from").map((c) => c.args[0]);
    expect(fromCalls).toEqual(["decks", "review_logs"]);
    expect(calls.find((c) => c.method === "gte")?.args).toEqual([
      "reviewed_at",
      "2026-06-14T00:00:00.000Z",
    ]);
  });
});
