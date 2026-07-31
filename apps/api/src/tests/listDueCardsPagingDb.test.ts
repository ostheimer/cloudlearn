/**
 * listDueCards must return EVERY due card, not just PostgREST's first page
 * (#698).
 *
 * countDueCards and countDueCardsByDeck already paged past PostgREST's
 * 1000-row cap via selectAllRows — that's what the home screen and the
 * folder/library badges show. listDueCards fed the actual learn round
 * (/learn/due) through a plain, unpaged `.select()`, so an account with more
 * than 1000 due cards saw the promised number ("1.400 fällig") while the
 * round itself silently stopped at 1000: the displayed count and the
 * delivered cards came from two differently-capped sources. The fix pages
 * listDueCards via selectAllRows too; these tests simulate the row cap with a
 * range-respecting fake so a regression to a single unpaged select fails
 * loudly, and pin that the three functions agree on the same backlog size.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));

import { countDueCards, countDueCardsByDeck, listDueCards } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase";

const mockedCreateDb = vi.mocked(createSupabaseAdminClient);

const USER_ID = "11111111-1111-4111-8111-111111111111";
const DECK_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DECK_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW_ISO = "2026-07-31T12:00:00.000Z";

interface RecordedCall {
  method: string;
  args: unknown[];
}

/** Minimal card row shaped like the `cards` table (index padded for sorting). */
function dueCardRow(index: number, deckId: string = DECK_A) {
  return {
    id: `card-${String(index).padStart(4, "0")}`,
    user_id: USER_ID,
    deck_id: deckId,
    front: `Frage ${index}`,
    back: `Antwort ${index}`,
    card_type: "basic",
    tags: [],
    fsrs_due: "2026-07-30T00:00:00.000Z",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    deleted_at: null,
  };
}

/**
 * Query-builder fake backed by a fixed row array — handles all three shapes
 * these functions issue against `cards`:
 *  - listDueCards / countDueCardsByDeck end the chain with `.range(from, to)`
 *    and get the matching slice back, exactly like PostgREST paging.
 *  - countDueCards uses `{ count: "exact", head: true }` and is awaited
 *    directly with no `.range()` call — Postgres returns the true total with
 *    no rows crossing the wire, so no page cap ever applies to it (that's the
 *    whole reason listDueCards needed the same paging countDueCards already had).
 */
function makeDueCardsDbMock(rows: unknown[]) {
  const calls: RecordedCall[] = [];

  const from = vi.fn((table: string) => {
    calls.push({ method: "from", args: [table] });
    const builder: Record<string, unknown> = {};
    builder.select = (...args: unknown[]) => {
      calls.push({ method: "select", args });
      return builder;
    };
    for (const method of ["eq", "neq", "is", "lte", "order"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return builder;
      };
    }
    builder.range = (fromIndex: number, toIndex: number) => {
      calls.push({ method: "range", args: [fromIndex, toIndex] });
      return Promise.resolve({ data: rows.slice(fromIndex, toIndex + 1), error: null });
    };
    // Only countDueCards' head:true query is awaited without calling
    // `.range()` first — this is what lets a count survive past the row cap.
    builder.then = (
      onFulfilled: (value: { count: number; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve({ count: rows.length, error: null }).then(onFulfilled, onRejected);
    return builder;
  });

  return { db: { from } as never, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listDueCards – pages past PostgREST's 1000-row cap (#698)", () => {
  it("returns all 1400 due cards of an over-cap backlog, in order", async () => {
    const rows = Array.from({ length: 1400 }, (_, i) => dueCardRow(i));
    const { db, calls } = makeDueCardsDbMock(rows);
    mockedCreateDb.mockReturnValue(db);

    const cards = await listDueCards(USER_ID, NOW_ISO);

    expect(cards).toHaveLength(1400);
    expect(cards[0]?.id).toBe("card-0000");
    expect(cards[1399]?.id).toBe("card-1399");
    // Two pages: a full one, then the 400-row remainder that ends the loop.
    expect(calls.filter((c) => c.method === "range").map((c) => c.args)).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("issues exactly one request for a backlog below the cap", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => dueCardRow(i));
    const { db, calls } = makeDueCardsDbMock(rows);
    mockedCreateDb.mockReturnValue(db);

    const cards = await listDueCards(USER_ID, NOW_ISO);

    expect(cards.map((c) => c.front)).toEqual(["Frage 0", "Frage 1", "Frage 2"]);
    expect(calls.filter((c) => c.method === "range")).toHaveLength(1);
  });

  it("keeps the fällig-zuerst ordering, the deterministic id tiebreaker, and the full filter set on every page", async () => {
    const rows = Array.from({ length: 2 }, (_, i) => dueCardRow(i));
    const { db, calls } = makeDueCardsDbMock(rows);
    mockedCreateDb.mockReturnValue(db);

    await listDueCards(USER_ID, NOW_ISO);

    expect(calls.find((c) => c.method === "select")?.args[0]).toBe(
      "*, decks!inner(deleted_at, archived_at)"
    );
    expect(calls.filter((c) => c.method === "eq").map((c) => c.args)).toContainEqual([
      "user_id",
      USER_ID,
    ]);
    const isCalls = calls.filter((c) => c.method === "is").map((c) => c.args);
    expect(isCalls).toContainEqual(["deleted_at", null]);
    expect(isCalls).toContainEqual(["decks.deleted_at", null]);
    expect(isCalls).toContainEqual(["decks.archived_at", null]);
    expect(calls.find((c) => c.method === "neq")?.args).toEqual(["card_type", "occlusion"]);
    expect(calls.find((c) => c.method === "lte")?.args).toEqual(["fsrs_due", NOW_ISO]);
    expect(calls.filter((c) => c.method === "order").map((c) => c.args)).toEqual([
      ["fsrs_due", { ascending: true }],
      ["id", { ascending: true }],
    ]);
  });

  it("surfaces a database error instead of returning a partial list", async () => {
    const from = vi.fn(() => {
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "neq", "is", "lte", "order"]) {
        builder[method] = () => builder;
      }
      builder.range = () => Promise.resolve({ data: null, error: { message: "connection lost" } });
      return builder;
    });
    mockedCreateDb.mockReturnValue({ from } as never);

    await expect(listDueCards(USER_ID, NOW_ISO)).rejects.toThrow("listDueCards: connection lost");
  });
});

describe("listDueCards vs. the displayed due counts – same backlog, same number (#698)", () => {
  it("delivers exactly as many cards as the home screen and the folder badges promise, past the row cap", async () => {
    // 900 in deck A + 500 in deck B = 1400, well past the 1000-row page size.
    // Before the fix, listDueCards silently stopped at 1000 while
    // countDueCards/countDueCardsByDeck (already paged) kept reporting 1400 —
    // exactly the "1.400 fällig, aber nur 1.000 in der Runde" bug from #698.
    const rows = [
      ...Array.from({ length: 900 }, (_, i) => dueCardRow(i, DECK_A)),
      ...Array.from({ length: 500 }, (_, i) => dueCardRow(900 + i, DECK_B)),
    ];
    const { db } = makeDueCardsDbMock(rows);
    mockedCreateDb.mockReturnValue(db);

    const delivered = await listDueCards(USER_ID, NOW_ISO);
    const displayedTotal = await countDueCards(USER_ID, NOW_ISO);
    const displayedByDeck = await countDueCardsByDeck(USER_ID, NOW_ISO);

    expect(delivered).toHaveLength(1400);
    expect(displayedTotal).toBe(1400);
    expect(displayedByDeck).toEqual({ [DECK_A]: 900, [DECK_B]: 500 });
    expect(Object.values(displayedByDeck).reduce((sum, n) => sum + n, 0)).toBe(
      delivered.length
    );
    expect(displayedTotal).toBe(delivered.length);
  });
});
