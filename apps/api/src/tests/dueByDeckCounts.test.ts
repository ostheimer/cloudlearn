/**
 * countDueCardsByDeck + GET /api/v1/stats/due-by-deck (#612).
 *
 * The "N fällig" badges in the library and folder views used to sum the
 * /learn/due response — the full backlog with card text crossed the wire only
 * to be thrown away, and PostgREST's silent 1000-row cap made the numbers lie
 * for exactly the users with the biggest backlogs. The grouped count fetches
 * only deck ids, pages past the cap, and must mirror listDueCards' filter set
 * (live deck, not deleted, no occlusion, fsrs_due <= now) so the badge never
 * promises cards the learn round won't serve.
 *
 * The route test goes through the real service + db layer against the same
 * query-builder fake, so the wire shape `{ dueByDeck }` is pinned end to end.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn() }));
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
vi.mock("@/lib/observability", () => ({
  createRequestContext: () => ({ requestId: "req-due-by-deck-1" }),
}));

import { countDueCardsByDeck } from "@/lib/db";
import { GET } from "../../app/api/v1/stats/due-by-deck/route";
import { getAuthUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

const mockedCreateDb = vi.mocked(createSupabaseAdminClient);
const mockedGetAuthUser = vi.mocked(getAuthUser);

const USER_ID = "11111111-1111-4111-8111-111111111111";
const DECK_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DECK_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW_ISO = "2026-07-29T12:00:00.000Z";

interface RecordedCall {
  method: string;
  args: unknown[];
}

/** Range-respecting query-builder fake (same idea as listCardsPagingDb.test.ts). */
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("countDueCardsByDeck – grouped counts with the /learn/due filter set", () => {
  it("groups due cards by their deck", async () => {
    const { db } = makePagedDbMock([
      { deck_id: DECK_A },
      { deck_id: DECK_A },
      { deck_id: DECK_B },
    ]);
    mockedCreateDb.mockReturnValue(db);

    await expect(countDueCardsByDeck(USER_ID, NOW_ISO)).resolves.toEqual({
      [DECK_A]: 2,
      [DECK_B]: 1,
    });
  });

  it("counts a backlog past PostgREST's 1000-row cap completely", async () => {
    // 1200 due cards in deck A, 300 in deck B — the old client-side sum over
    // /learn/due saw exactly 1000 of these and reported garbage.
    const rows = [
      ...Array.from({ length: 1200 }, () => ({ deck_id: DECK_A })),
      ...Array.from({ length: 300 }, () => ({ deck_id: DECK_B })),
    ];
    const { db, calls } = makePagedDbMock(rows);
    mockedCreateDb.mockReturnValue(db);

    await expect(countDueCardsByDeck(USER_ID, NOW_ISO)).resolves.toEqual({
      [DECK_A]: 1200,
      [DECK_B]: 300,
    });
    expect(calls.filter((c) => c.method === "range").map((c) => c.args)).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("returns an empty object when nothing is due", async () => {
    const { db } = makePagedDbMock([]);
    mockedCreateDb.mockReturnValue(db);

    await expect(countDueCardsByDeck(USER_ID, NOW_ISO)).resolves.toEqual({});
  });

  it("applies the exact listDueCards filter set — live deck, no occlusion, due by now", async () => {
    const { db, calls } = makePagedDbMock([]);
    mockedCreateDb.mockReturnValue(db);

    await countDueCardsByDeck(USER_ID, NOW_ISO);

    // Only deck ids cross the wire, and the inner join keeps soft-deleted
    // decks' cards out (#495).
    expect(calls.find((c) => c.method === "select")?.args[0]).toBe(
      "deck_id, decks!inner(deleted_at)"
    );
    expect(calls.filter((c) => c.method === "eq").map((c) => c.args)).toContainEqual([
      "user_id",
      USER_ID,
    ]);
    const isCalls = calls.filter((c) => c.method === "is").map((c) => c.args);
    expect(isCalls).toContainEqual(["deleted_at", null]);
    expect(isCalls).toContainEqual(["decks.deleted_at", null]);
    // Occlusion cards are learnable only in Bild-Abdecken, never in the
    // flashcard round the badge advertises.
    expect(calls.find((c) => c.method === "neq")?.args).toEqual(["card_type", "occlusion"]);
    expect(calls.find((c) => c.method === "lte")?.args).toEqual(["fsrs_due", NOW_ISO]);
  });

  it("surfaces a database error instead of returning partial counts", async () => {
    const from = vi.fn(() => {
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "neq", "is", "lte", "order"]) {
        builder[method] = () => builder;
      }
      builder.range = () => Promise.resolve({ data: null, error: { message: "connection lost" } });
      return builder;
    });
    mockedCreateDb.mockReturnValue({ from } as never);

    await expect(countDueCardsByDeck(USER_ID, NOW_ISO)).rejects.toThrow(
      "countDueCardsByDeck: connection lost"
    );
  });
});

describe("GET /api/v1/stats/due-by-deck – wire contract", () => {
  function getRequest() {
    return new Request("http://localhost/api/v1/stats/due-by-deck", { method: "GET" }) as never;
  }

  it("returns the grouped counts for the authenticated user", async () => {
    mockedGetAuthUser.mockResolvedValue({ userId: USER_ID, email: "lara@example.com" });
    const { db, calls } = makePagedDbMock([{ deck_id: DECK_A }, { deck_id: DECK_B }]);
    mockedCreateDb.mockReturnValue(db);

    const response = await GET(getRequest());
    const body = (await response.json()) as { dueByDeck: Record<string, number> };

    expect(response.status).toBe(200);
    expect(body.dueByDeck).toEqual({ [DECK_A]: 1, [DECK_B]: 1 });
    // The count is scoped to the caller — never to a client-supplied id.
    expect(calls.filter((c) => c.method === "eq").map((c) => c.args)).toContainEqual([
      "user_id",
      USER_ID,
    ]);
  });

  it("returns 401 without a valid token and never touches the database", async () => {
    mockedGetAuthUser.mockResolvedValue(null);

    const response = await GET(getRequest());

    expect(response.status).toBe(401);
    expect(mockedCreateDb).not.toHaveBeenCalled();
  });

  it("surfaces a database error as a 500", async () => {
    mockedGetAuthUser.mockResolvedValue({ userId: USER_ID, email: "lara@example.com" });
    const from = vi.fn(() => {
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "neq", "is", "lte", "order"]) {
        builder[method] = () => builder;
      }
      builder.range = () => Promise.resolve({ data: null, error: { message: "connection lost" } });
      return builder;
    });
    mockedCreateDb.mockReturnValue({ from } as never);

    const response = await GET(getRequest());
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(500);
    expect(body.message).toContain("connection lost");
  });
});
