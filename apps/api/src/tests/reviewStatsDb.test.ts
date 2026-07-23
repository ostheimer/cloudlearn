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
 * the next queued response — getReviewStats awaits ten queries in a fixed
 * order (today / week / all-time total counts, then the window's total and
 * good counts, then vier Zählungen für die nach Art getrennte Quote, dann die
 * Tageszeilen).
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
    // "range" gehört dazu, seit die Tagesdaten geblättert werden
    // (1000-Zeilen-Grenze). "neq" nutzt getReviewStats aktuell nicht mehr,
    // bleibt aber stehen: die Attrappe soll an einem wiederkehrenden Filter
    // nicht zerbrechen. Fehlt eine Methode hier, wirft der Aufruf
    // „is not a function" — schon einmal so passiert (#334).
    for (const method of ["select", "eq", "neq", "gte", "lte", "in", "order", "limit", "range"]) {
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

/**
 * Responses in getReviewStats' query order: today, week, all-time total,
 * window total, window good, dann je Gruppe total+good (Abruf, dann
 * Wiedererkennen), dann daily rows.
 *
 * Die vier Gruppen-Zählungen laufen per Promise.all, aber `from()` wird beim
 * Start jeder einzelnen synchron gerufen — die Reihenfolge in der Warteschlange
 * steht also fest.
 */
function statsResponses(
  dailyRows: unknown[],
  windowTotal = 80,
  windowGood = 60,
  recallTotal = 50,
  recallGood = 26,
  recognitionTotal = 20,
  recognitionGood = 18
): QueryResponse[] {
  return [
    { count: 3, error: null },
    { count: 12, error: null },
    { count: 200, error: null },
    { count: windowTotal, error: null },
    { count: windowGood, error: null },
    { count: recallTotal, error: null },
    { count: recallGood, error: null },
    { count: recognitionTotal, error: null },
    { count: recognitionGood, error: null },
    { data: dailyRows, error: null },
  ];
}

/** Split the flat call log into one group per query (each starts with `from`). */
function queriesOf(calls: RecordedCall[]): RecordedCall[][] {
  const queries: RecordedCall[][] = [];
  for (const call of calls) {
    if (call.method === "from") queries.push([]);
    queries.at(-1)?.push(call);
  }
  return queries;
}

/** The `.gte(...)` arguments a single query was built with, in order. */
function gteArgsOf(query: RecordedCall[] | undefined): unknown[][] {
  return (query ?? []).filter((c) => c.method === "gte").map((c) => c.args);
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

  it("pages the daily rows so a busy month doesn't lose its newest days", async () => {
    // PostgREST returns at most 1000 rows per request and says nothing about
    // the rest. These rows are sorted oldest-first, so an unpaged fetch stops
    // inside the older day and today's 200 answers read as zero — the bar
    // chart would show an empty column for a day that was actually studied.
    const olderPage = Array.from({ length: 1000 }, () => ({
      reviewed_at: "2026-07-12T08:00:00.000Z",
      rating: 3,
      review_duration_ms: 1000,
    }));
    const newestPage = Array.from({ length: 200 }, () => ({
      reviewed_at: "2026-07-13T10:00:00.000Z",
      rating: 3,
      review_duration_ms: 1000,
    }));
    const { db, calls } = makeDbMock([
      { count: 3, error: null },
      { count: 12, error: null },
      { count: 1200, error: null },
      { count: 1200, error: null },
      { count: 1200, error: null },
      // Die vier Zählungen der nach Art getrennten Quote. Hier egal, aber sie
      // stehen in der Warteschlange VOR den Tageszeilen — fehlten sie, rutschte
      // die erste Seite an ihre Stelle und der Test prüfte die falsche Abfrage.
      { count: 1000, error: null },
      { count: 800, error: null },
      { count: 200, error: null },
      { count: 150, error: null },
      { data: olderPage, error: null },
      { data: newestPage, error: null },
    ]);
    mockedCreateDb.mockReturnValue(db);

    const stats = await getReviewStats(USER_ID, 30);

    expect(stats.reviewsByDay.find((d) => d.date === "2026-07-12")?.count).toBe(1000);
    expect(stats.reviewsByDay.find((d) => d.date === "2026-07-13")?.count).toBe(200);

    // A full page must be followed by a request for the next one.
    const ranges = calls.filter((c) => c.method === "range").map((c) => c.args);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("stops after a short page instead of asking forever", async () => {
    const { db, calls } = makeDbMock(statsResponses(DAILY_ROWS));
    mockedCreateDb.mockReturnValue(db);

    await getReviewStats(USER_ID, 30);

    // 3 rows came back for a 1000-row request: there cannot be more.
    expect(calls.filter((c) => c.method === "range").map((c) => c.args)).toEqual([[0, 999]]);
  });

  it("passes the scalar aggregates through unchanged", async () => {
    const { db } = makeDbMock(statsResponses(DAILY_ROWS));
    mockedCreateDb.mockReturnValue(db);

    const stats = await getReviewStats(USER_ID, 30);

    expect(stats.reviewsToday).toBe(3);
    expect(stats.reviewsThisWeek).toBe(12);
    // All-time on purpose — its name says so, unlike accuracyRate's.
    expect(stats.reviewsTotal).toBe(200);
  });

  it("fences both accuracy counts to the window, not to all time", async () => {
    const { db, calls } = makeDbMock(statsResponses([]));
    mockedCreateDb.mockReturnValue(db);

    await getReviewStats(USER_ID, 7);

    const [, , , windowTotalQuery, windowGoodQuery] = queriesOf(calls);
    const windowStart = "2026-07-07T00:00:00.000Z";

    expect(gteArgsOf(windowTotalQuery)).toEqual([["reviewed_at", windowStart]]);
    // The regression this pins down: the good-count query used to carry only
    // ["rating", 3] — no date fence — so "Genauigkeit" silently meant
    // "since you started" while sitting next to a 7/30-day switch.
    expect(gteArgsOf(windowGoodQuery)).toEqual([
      ["reviewed_at", windowStart],
      ["rating", 3],
    ]);
  });

  it("derives accuracyRate from the window's own counts", async () => {
    // 60 of 80 answers in the window were good — 75 %, regardless of the 200
    // answers this user has given in total.
    const { db } = makeDbMock(statsResponses(DAILY_ROWS, 80, 60));
    mockedCreateDb.mockReturnValue(db);

    const stats = await getReviewStats(USER_ID, 30);

    expect(stats.accuracyRate).toBe(0.75);
    expect(stats.reviewsInWindow).toBe(80);
  });

  it("reports an empty window as 0 answers rather than falling back to all time", async () => {
    // Nothing studied in the window, but 200 answers on the clock. Clients show
    // a dash off reviewsInWindow; a 0 here must not read as "0 % correct".
    const { db } = makeDbMock(statsResponses([], 0, 0));
    mockedCreateDb.mockReturnValue(db);

    const stats = await getReviewStats(USER_ID, 7);

    expect(stats.reviewsInWindow).toBe(0);
    expect(stats.accuracyRate).toBe(0);
    expect(stats.reviewsTotal).toBe(200);
  });

  it("zählt Prüfungen in den MENGEN mit, lässt sie aus den QUOTEN heraus", async () => {
    // Verfeinerung von Laras 17.07.-Regel „alles was ich gemacht habe soll
    // zählen": Das gilt für MENGEN (heute/Woche/gesamt/Karten pro Tag) — die
    // filtern nach wie vor NICHT nach mode. QUOTEN dagegen (Trefferquote im
    // Fenster) lassen Prüfungen aus, weil eine Prüfung unter Druck misst und
    // die Lern-Trefferquote sonst drückte; sie bekommt ihre eigene Zahl. Ohne
    // diese Trennung stünden auf einer Seite mehrere „wie gut"-Zahlen, die
    // dieselbe Prüfung verschieden verrechnen.
    const { db, calls } = makeDbMock(statsResponses(DAILY_ROWS));
    mockedCreateDb.mockReturnValue(db);

    await getReviewStats(USER_ID, 30);

    // Reihenfolge: today, week, total, windowTotal, windowGood, dann die vier
    // accuracyByKind-Zählungen, dann die Tageszeilen.
    const queries = queriesOf(calls);
    const neqArgs = (q: RecordedCall[] | undefined) =>
      (q ?? []).filter((c) => c.method === "neq").map((c) => c.args);

    // Mengen — kein mode-Filter.
    expect(neqArgs(queries[0])).toEqual([]); // heute (Tagesziel-Balken)
    expect(neqArgs(queries[1])).toEqual([]); // diese Woche
    expect(neqArgs(queries[2])).toEqual([]); // gesamt
    // Quoten — Prüfungen ausgeschlossen.
    expect(neqArgs(queries[3])).toEqual([["mode", "test"]]); // windowTotal (Nenner)
    expect(neqArgs(queries[4])).toEqual([["mode", "test"]]); // windowGood (Zähler)
  });

  it("ein reiner Prüfungstag zählt als Karte, aber nicht in der Tages-Quote", async () => {
    // Der Split lebt in EINER Zeilenabfrage: count/durationMs zählen alles,
    // quotaCount/good lassen Prüfungen aus. Ein Tag mit nur einer Prüfung soll
    // im Balken „Karten pro Tag" erscheinen (Menge), im Trefferquote-Verlauf
    // aber NICHT — sonst stünde dort ein Prozent an einem Tag, an dem geprüft
    // und nicht gelernt wurde.
    const rows = [
      // 2026-07-12: zwei echte Lernantworten (gut + Fehler)
      { reviewed_at: "2026-07-12T08:00:00.000Z", rating: 4, review_duration_ms: 1000, mode: "flashcard" },
      { reviewed_at: "2026-07-12T09:00:00.000Z", rating: 1, review_duration_ms: 1000, mode: "flashcard" },
      // 2026-07-13: ausschließlich eine Prüfung
      { reviewed_at: "2026-07-13T10:00:00.000Z", rating: 4, review_duration_ms: 5000, mode: "test" },
    ];
    const { db } = makeDbMock(statsResponses(rows));
    mockedCreateDb.mockReturnValue(db);

    const stats = await getReviewStats(USER_ID, 7);

    // Menge: der Prüfungstag hat eine Karte, und die Lernzeit zählt.
    expect(stats.reviewsByDay.find((d) => d.date === "2026-07-13")?.count).toBe(1);
    expect(stats.durationMsByDay.find((d) => d.date === "2026-07-13")?.durationMs).toBe(5000);
    // Quote: der reine Prüfungstag erscheint NICHT im Verlauf …
    expect(stats.accuracyByDay.map((d) => d.date)).toEqual(["2026-07-12"]);
    // … und der Lerntag rechnet nur seine zwei Lernantworten (1 von 2).
    expect(stats.accuracyByDay[0]).toEqual({ date: "2026-07-12", count: 2, accuracy: 0.5 });
  });

  it("rechnet die getrennte Quote je Gruppe mit dem EIGENEN Nenner", async () => {
    // 26 von 50 abgerufen (52 %), 18 von 20 wiedererkannt (90 %). Absichtlich
    // so gewählt, dass die falsche Rechnung auffiele: über beide Gruppen
    // zusammen wären es 44/70 = 63 %, und keiner der beiden Werte käme heraus.
    const { db } = makeDbMock(statsResponses(DAILY_ROWS, 80, 60, 50, 26, 20, 18));
    mockedCreateDb.mockReturnValue(db);

    const stats = await getReviewStats(USER_ID, 30);

    expect(stats.accuracyByKind).toEqual({
      recall: { rate: 0.52, answers: 50 },
      recognition: { rate: 0.9, answers: 20 },
    });
    // Die Gruppen summieren sich NICHT auf das Fenster (50 + 20 < 80): die
    // Differenz sind Prüfungen, die keiner Gruppe angehören. Stünde hier
    // Gleichheit, wäre 'test' versehentlich in eine Gruppe gerutscht.
    expect(stats.accuracyByKind.recall.answers + stats.accuracyByKind.recognition.answers)
      .toBeLessThan(stats.reviewsInWindow);
  });

  it("meldet eine nie benutzte Gruppe als 0 Antworten statt als 0 %", async () => {
    // Laras Stand heute: Multiple Choice und Zuordnen noch nie gespielt. „0 %"
    // wäre eine Behauptung über Antworten, die es nicht gibt — der Client
    // erkennt den Unterschied nur an `answers` und zeigt sonst einen Strich.
    const { db } = makeDbMock(statsResponses(DAILY_ROWS, 80, 60, 177, 92, 0, 0));
    mockedCreateDb.mockReturnValue(db);

    const stats = await getReviewStats(USER_ID, 30);

    expect(stats.accuracyByKind.recognition).toEqual({ rate: 0, answers: 0 });
    expect(stats.accuracyByKind.recall.answers).toBe(177);
  });

  it("filtert die beiden Gruppen nach den richtigen Modi — und nie nach 'test'", async () => {
    const { db, calls } = makeDbMock(statsResponses(DAILY_ROWS));
    mockedCreateDb.mockReturnValue(db);

    await getReviewStats(USER_ID, 30);

    // Vier Abfragen mit .in("mode", …): je total und good pro Gruppe.
    const modeFilter = calls
      .filter((c) => c.method === "in" && c.args[0] === "mode")
      .map((c) => c.args[1]);

    expect(modeFilter).toHaveLength(4);
    expect(modeFilter[0]).toEqual(["flashcard", "practice", "cloze", "occlusion"]);
    expect(modeFilter[1]).toEqual(["flashcard", "practice", "cloze", "occlusion"]);
    expect(modeFilter[2]).toEqual(["quiz", "match"]);
    expect(modeFilter[3]).toEqual(["quiz", "match"]);
    // Rutschte 'test' in eine Gruppe, stünden Prüfungszahlen in einer Quote,
    // neben der sie gleich nochmal einzeln stehen — dieselbe Größe zweimal
    // verschieden, genau der Widerspruch aus #390.
    for (const modes of modeFilter) {
      expect(modes).not.toContain("test");
    }
  });
});
