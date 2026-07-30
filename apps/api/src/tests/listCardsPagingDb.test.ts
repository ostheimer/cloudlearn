/**
 * listCardsForDeck must return EVERY card of a deck, not just PostgREST's
 * first page (#612).
 *
 * PostgREST hands back at most 1000 rows per request and says nothing about
 * the rest — no error, no marker. A Pro deck may hold 2000 cards, so a plain
 * `.select()` silently hid card 1001+ from the deck page and every learn mode
 * fed by it. The fix pages via selectAllRows; these tests simulate the row cap
 * with a range-respecting fake so a regression to a single unpaged select
 * fails loudly (it would issue no `.range` calls and the fake returns nothing).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));

import { listCardsForDeck } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase";

const mockedCreateDb = vi.mocked(createSupabaseAdminClient);

const USER_ID = "11111111-1111-4111-8111-111111111111";
const DECK_ID = "22222222-2222-4222-8222-222222222222";

interface RecordedCall {
  method: string;
  args: unknown[];
}

/**
 * Query-builder fake backed by a fixed row array. Chained filter/order calls
 * are recorded and return the builder; `.range(from, to)` resolves the matching
 * slice — like PostgREST, it never reports how many rows exist beyond the page.
 */
function makePagedDbMock(rows: unknown[]) {
  const calls: RecordedCall[] = [];

  const from = vi.fn((table: string) => {
    calls.push({ method: "from", args: [table] });
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "neq", "is", "lte", "order"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return builder;
      };
    }
    builder.range = (fromIndex: number, toIndex: number) => {
      calls.push({ method: "range", args: [fromIndex, toIndex] });
      return Promise.resolve({ data: rows.slice(fromIndex, toIndex + 1), error: null });
    };
    return builder;
  });

  return { db: { from } as never, calls };
}

/** Minimal card row shaped like the `cards` table (index padded for sorting). */
function cardRow(index: number) {
  return {
    id: `card-${String(index).padStart(4, "0")}`,
    user_id: USER_ID,
    deck_id: DECK_ID,
    front: `Frage ${index}`,
    back: `Antwort ${index}`,
    card_type: "basic",
    tags: [],
    fsrs_due: "2026-07-29T00:00:00.000Z",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    deleted_at: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listCardsForDeck – pages past PostgREST's 1000-row cap (#612)", () => {
  it("returns all 1500 cards of an over-cap deck, in order", async () => {
    const rows = Array.from({ length: 1500 }, (_, i) => cardRow(i));
    const { db, calls } = makePagedDbMock(rows);
    mockedCreateDb.mockReturnValue(db);

    const cards = await listCardsForDeck(USER_ID, DECK_ID);

    expect(cards).toHaveLength(1500);
    expect(cards[0]?.id).toBe("card-0000");
    expect(cards[1499]?.id).toBe("card-1499");
    // Two pages: a full one, then the 500-row remainder that ends the loop.
    expect(calls.filter((c) => c.method === "range").map((c) => c.args)).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("issues exactly one request for a deck below the cap", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => cardRow(i));
    const { db, calls } = makePagedDbMock(rows);
    mockedCreateDb.mockReturnValue(db);

    const cards = await listCardsForDeck(USER_ID, DECK_ID);

    expect(cards.map((c) => c.front)).toEqual(["Frage 0", "Frage 1", "Frage 2"]);
    expect(calls.filter((c) => c.method === "range")).toHaveLength(1);
  });

  it("keeps a full-page boundary honest (exactly 1000 cards, no phantom page)", async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => cardRow(i));
    const { db, calls } = makePagedDbMock(rows);
    mockedCreateDb.mockReturnValue(db);

    const cards = await listCardsForDeck(USER_ID, DECK_ID);

    expect(cards).toHaveLength(1000);
    // The first page comes back full, so one follow-up (empty) page is the
    // only way to know the table is exhausted.
    expect(calls.filter((c) => c.method === "range").map((c) => c.args)).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("keeps the deterministic #499 ordering and the scoping filters on every page", async () => {
    const rows = Array.from({ length: 2 }, (_, i) => cardRow(i));
    const { db, calls } = makePagedDbMock(rows);
    mockedCreateDb.mockReturnValue(db);

    await listCardsForDeck(USER_ID, DECK_ID);

    const eqCalls = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqCalls).toContainEqual(["user_id", USER_ID]);
    expect(eqCalls).toContainEqual(["deck_id", DECK_ID]);
    expect(calls.find((c) => c.method === "is")?.args).toEqual(["deleted_at", null]);
    expect(calls.filter((c) => c.method === "order").map((c) => c.args)).toEqual([
      ["created_at", { ascending: true }],
      ["id", { ascending: true }],
    ]);
  });

  it("surfaces a database error instead of returning a partial list", async () => {
    const from = vi.fn(() => {
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "is", "order"]) {
        builder[method] = () => builder;
      }
      builder.range = () => Promise.resolve({ data: null, error: { message: "connection lost" } });
      return builder;
    });
    mockedCreateDb.mockReturnValue({ from } as never);

    await expect(listCardsForDeck(USER_ID, DECK_ID)).rejects.toThrow(
      "listCardsForDeck: connection lost"
    );
  });
});
