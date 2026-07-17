/**
 * Tests for getReviewStats' by-day window (Statistik-Ausbau C+D).
 *
 * The window is generalized to `days` (7 or 30): `reviewsByDay` and the new
 * `durationMsByDay` are zero-filled to exactly `days` contiguous UTC dates
 * ending today, while `accuracyByDay` keeps only days that actually have
 * reviews (a synthetic 0 % would distort the trend line).
 *
 * The Supabase admin client is replaced with a thenable query-builder fake:
 * every chained method returns the builder itself, and awaiting it resolves
 * the next queued response — getReviewStats awaits five queries in a fixed
 * order (today / week / total / good counts, then the daily rows).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));

import { getReviewStats } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase";

const mockedCreateDb = vi.mocked(createSupabaseAdminClient);

const USER_ID = "11111111-1111-4111-8111-111111111111";
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
    // "neq" gehört dazu, seit die Tagesziel-Zählung Prüfungen ausschließt.
    // Fehlt eine Methode hier, wirft der Aufruf „is not a function" — schon
    // einmal so passiert (#334).
    for (const method of ["select", "eq", "neq", "gte", "lte", "order", "limit"]) {
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

/** Responses in getReviewStats' query order: today, week, total, good, daily. */
function statsResponses(dailyRows: unknown[]): QueryResponse[] {
  return [
    { count: 3, error: null },
    { count: 12, error: null },
    { count: 200, error: null },
    { count: 150, error: null },
    { data: dailyRows, error: null },
  ];
}

const DAILY_ROWS = [
  // 2026-07-12: one good and one failed review, one duration missing (null)
  { reviewed_at: "2026-07-12T08:00:00.000Z", rating: 4, review_duration_ms: 90000 },
  { reviewed_at: "2026-07-12T09:00:00.000Z", rating: 1, review_duration_ms: null },
  // 2026-07-13 (today): one good review
  { reviewed_at: "2026-07-13T10:00:00.000Z", rating: 3, review_duration_ms: 30000 },
];

describe("getReviewStats – 7/30-day window + durationMsByDay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns exactly 30 zero-filled entries by default (historic window)", async () => {
    const { db } = makeDbMock(statsResponses(DAILY_ROWS));
    mockedCreateDb.mockReturnValue(db);

    const stats = await getReviewStats(USER_ID);

    expect(stats.reviewsByDay).toHaveLength(30);
    expect(stats.durationMsByDay).toHaveLength(30);
    expect(stats.reviewsByDay[0]?.date).toBe("2026-06-14");
    expect(stats.reviewsByDay[29]?.date).toBe("2026-07-13");
    // Days without reviews are present with count 0
    expect(stats.reviewsByDay.filter((d) => d.count === 0)).toHaveLength(28);
  });

  it("returns exactly 30 entries for days=30", async () => {
    const { db } = makeDbMock(statsResponses(DAILY_ROWS));
    mockedCreateDb.mockReturnValue(db);

    const stats = await getReviewStats(USER_ID, 30);

    expect(stats.reviewsByDay).toHaveLength(30);
    expect(stats.durationMsByDay).toHaveLength(30);
    expect(stats.reviewsByDay[0]?.date).toBe("2026-06-14");
    expect(stats.reviewsByDay[29]?.date).toBe("2026-07-13");
  });

  it("aggregates counts and durations per day, treating null durations as 0", async () => {
    const { db } = makeDbMock(statsResponses(DAILY_ROWS));
    mockedCreateDb.mockReturnValue(db);

    const stats = await getReviewStats(USER_ID, 7);

    expect(stats.reviewsByDay.find((d) => d.date === "2026-07-12")).toEqual({
      date: "2026-07-12",
      count: 2,
    });
    expect(stats.durationMsByDay.find((d) => d.date === "2026-07-12")).toEqual({
      date: "2026-07-12",
      durationMs: 90000, // 90000 + null→0
    });
    expect(stats.durationMsByDay.find((d) => d.date === "2026-07-13")).toEqual({
      date: "2026-07-13",
      durationMs: 30000,
    });
    expect(stats.durationMsByDay.find((d) => d.date === "2026-07-10")).toEqual({
      date: "2026-07-10",
      durationMs: 0,
    });
  });

  it("keeps accuracyByDay limited to days with reviews", async () => {
    const { db } = makeDbMock(statsResponses(DAILY_ROWS));
    mockedCreateDb.mockReturnValue(db);

    const stats = await getReviewStats(USER_ID, 7);

    expect(stats.accuracyByDay).toEqual([
      { date: "2026-07-12", count: 2, accuracy: 0.5 },
      { date: "2026-07-13", count: 1, accuracy: 1 },
    ]);
  });

  it("queries the daily rows from the start of the window", async () => {
    const { db, calls } = makeDbMock(statsResponses([]));
    mockedCreateDb.mockReturnValue(db);

    await getReviewStats(USER_ID, 7);

    const gteCalls = calls.filter((c) => c.method === "gte");
    expect(gteCalls.at(-1)?.args).toEqual([
      "reviewed_at",
      "2026-07-07T00:00:00.000Z",
    ]);
  });

  it("passes the scalar aggregates through unchanged", async () => {
    const { db } = makeDbMock(statsResponses(DAILY_ROWS));
    mockedCreateDb.mockReturnValue(db);

    const stats = await getReviewStats(USER_ID, 30);

    expect(stats.reviewsToday).toBe(3);
    expect(stats.reviewsThisWeek).toBe(12);
    expect(stats.reviewsTotal).toBe(200);
    expect(stats.accuracyRate).toBe(0.75); // 150 / 200
  });

  it("keeps test-mode reviews out of the daily goal — but inside the statistics", async () => {
    // Laras Regel: „Beim Test sollte man keine Lernpunkte bekommen oder etwas
    // bei Tagesziel, da man ja im Prinzip nicht gelernt hat." reviewsToday
    // speist den Tagesziel-Balken (reviewsToday / dailyGoal auf Home).
    //
    // Statistik dagegen bleibt „ein Topf": Woche, Gesamt und Trefferquote
    // zählen Prüfungen mit — dort ist die Prüfung sogar die ehrlichste Zahl.
    const { db, calls } = makeDbMock(statsResponses(DAILY_ROWS));
    mockedCreateDb.mockReturnValue(db);

    await getReviewStats(USER_ID, 30);

    // Nur die ERSTE Abfrage (heute) darf Prüfungen ausschließen.
    const neqCalls = calls.filter((c) => c.method === "neq");
    expect(neqCalls).toHaveLength(1);
    expect(neqCalls[0]?.args).toEqual(["mode", "test"]);
  });
});
