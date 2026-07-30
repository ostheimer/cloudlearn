/**
 * Route-level tests for GET /api/v1/leaderboard/global.
 *
 * The rank shown to the caller used to be sourced by `find()`-ing them in the
 * *top-50 array* and falling back to `?? 0`:
 *
 *   .gt("lp_balance", topUsers?.find((u) => u.id === auth.userId)?.lp_balance ?? 0)
 *
 * For everyone outside the top 50 that `find()` returns `undefined`, so the
 * query counted every profile above 0 LP. `lp_balance` is NOT NULL DEFAULT 10
 * (20260312150000_add_lp_system.sql), so that is essentially the whole table and
 * the caller was told `myRank = totalUsers + 1`. Both clients render `myRank`
 * precisely when the user is *not* in the list, so it was wrong 100% of the time
 * it was displayed.
 *
 * The db is mocked as a small simulated `profiles` table: the top-50 query, the
 * `.gt()` count and the own-balance lookup all derive from the same rows, so the
 * old implementation reproduces its real-world bug against these mocks instead of
 * being hand-fed the right answer.
 *
 * `@/lib/http` is mocked with light Response-shaped fakes so the test never has
 * to load `next/server`.
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
vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/observability", () => ({
  createRequestContext: () => ({ requestId: "req-leaderboard-1" }),
}));

import { GET } from "../../app/api/v1/leaderboard/global/route";
import { getAuthUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedCreateDb = vi.mocked(createSupabaseAdminClient);

const AUTH_USER_ID = "11111111-1111-4111-8111-111111111111";
const PAGE_SIZE = 50;

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  lp_balance: number;
  subscription_tier: string | null;
  current_streak: number | null;
};

type Entry = {
  rank: number;
  displayName: string;
  avatarUrl: string | null;
  lpBalance: number;
  tier: string;
  currentStreak: number;
  isCurrentUser: boolean;
};

type Body = { entries: Entry[]; myRank: number | null; total: number };

function profile(id: string, lpBalance: number, overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id,
    display_name: `User ${id}`,
    avatar_url: null,
    lp_balance: lpBalance,
    subscription_tier: "free",
    current_streak: 0,
    ...overrides,
  };
}

/** `n` distinct profiles, each comfortably above `minLp`. */
function othersAbove(n: number, minLp: number): ProfileRow[] {
  return Array.from({ length: n }, (_, i) => profile(`above-${i}`, minLp + n - i));
}

/**
 * Mock of the service-role client backed by a simulated `profiles` table.
 * Array.prototype.sort is stable, so rows tied on lp_balance keep the order in
 * which they were passed in — which is what lets the tie tests pin down an exact
 * board position.
 */
function makeDbMock(table: ProfileRow[]) {
  const gt = vi.fn(async (_column: string, threshold: number) => ({
    count: table.filter((row) => row.lp_balance > threshold).length,
    error: null,
  }));
  const limit = vi.fn(async (count: number) => ({
    data: [...table].sort((a, b) => b.lp_balance - a.lp_balance).slice(0, count),
    error: null,
  }));
  const ownBalanceLookup = vi.fn();
  // Recorded .order(...) calls of the board query — the tiebreaker contract
  // (#612) is asserted against this list.
  const orderCalls: unknown[][] = [];

  const from = vi.fn((_table: string) => ({
    select: (columns: string, options?: { count?: string; head?: boolean }) => {
      // count(*) probe: .select("id", { count: "exact", head: true }).gt(...)
      if (options?.head) return { gt };
      // own balance: .select("lp_balance").eq("id", uid).maybeSingle()
      if (columns === "lp_balance") {
        return {
          eq: (_column: string, id: string) => ({
            maybeSingle: async () => {
              ownBalanceLookup(id);
              const row = table.find((candidate) => candidate.id === id);
              return { data: row ? { lp_balance: row.lp_balance } : null, error: null };
            },
          }),
        };
      }
      // top-50 board: .select(cols).order(...).order(...).order(...).limit(PAGE_SIZE)
      type BoardQuery = { order: (...args: unknown[]) => BoardQuery; limit: typeof limit };
      const boardQuery: BoardQuery = {
        order: (...args: unknown[]) => {
          orderCalls.push(args);
          return boardQuery;
        },
        limit,
      };
      return boardQuery;
    },
  }));

  return { db: { from } as never, gt, limit, ownBalanceLookup, orderCalls };
}

function getRequest() {
  return new Request("http://localhost/api/v1/leaderboard/global", { method: "GET" }) as never;
}

async function getBody(table: ProfileRow[]) {
  const { db, ownBalanceLookup, gt, orderCalls } = makeDbMock(table);
  mockedCreateDb.mockReturnValue(db);
  const response = await GET(getRequest());
  return { response, body: (await response.json()) as Body, ownBalanceLookup, gt, orderCalls };
}

describe("GET /api/v1/leaderboard/global – myRank outside the top 50", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockResolvedValue({ userId: AUTH_USER_ID, email: "lara@example.com" });
  });

  it("ranks a caller below the board by the users actually above them, not by the whole table", async () => {
    // 59 users above the caller, the caller at 200 LP, and 40 users sitting on
    // the default 10 LP balance below them.
    const table = [
      ...othersAbove(59, 200),
      profile(AUTH_USER_ID, 200),
      ...Array.from({ length: 40 }, (_, i) => profile(`below-${i}`, 10)),
    ];
    const totalUsers = table.length; // 100

    const { response, body } = await getBody(table);

    expect(response.status).toBe(200);
    // The caller is genuinely off the board — this is the case the clients render.
    expect(body.entries.some((entry) => entry.isCurrentUser)).toBe(false);
    expect(body.myRank).toBe(60);
    // The old `?? 0` fallback counted every profile above 0 LP and produced
    // exactly this. lp_balance is NOT NULL DEFAULT 10, so "everyone" is the norm.
    expect(body.myRank).not.toBe(totalUsers + 1);
  });

  it("reads the caller's own balance directly instead of deriving it from the board", async () => {
    const table = [
      ...othersAbove(59, 200),
      profile(AUTH_USER_ID, 200),
      ...Array.from({ length: 40 }, (_, i) => profile(`below-${i}`, 10)),
    ];

    const { ownBalanceLookup, gt } = await getBody(table);

    expect(ownBalanceLookup).toHaveBeenCalledWith(AUTH_USER_ID);
    // The threshold must be the caller's real balance (200) — never the 0 that
    // the removed `?? 0` fallback used to smuggle in.
    expect(gt).toHaveBeenCalledWith("lp_balance", 200);
    expect(gt).not.toHaveBeenCalledWith("lp_balance", 0);
  });

  it("gives every caller tied on the same balance the same rank below the board", async () => {
    // 55 above, then four users (incl. the caller) all tied on 100 LP.
    const table = [
      ...othersAbove(55, 100),
      profile("tie-a", 100),
      profile(AUTH_USER_ID, 100),
      profile("tie-b", 100),
      profile("tie-c", 100),
    ];

    const { body } = await getBody(table);

    expect(body.entries.some((entry) => entry.isCurrentUser)).toBe(false);
    // Competition ranking: the tie-mates do not push the caller down.
    expect(body.myRank).toBe(56);
  });
});

describe("GET /api/v1/leaderboard/global – myRank on the board", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockResolvedValue({ userId: AUTH_USER_ID, email: "lara@example.com" });
  });

  it("uses the caller's position in the returned list", async () => {
    const table = [
      ...othersAbove(10, 500),
      profile(AUTH_USER_ID, 500),
      ...Array.from({ length: 20 }, (_, i) => profile(`below-${i}`, 10)),
    ];

    const { body } = await getBody(table);

    const ownEntry = body.entries.find((entry) => entry.isCurrentUser);
    expect(ownEntry).toBeDefined();
    expect(body.myRank).toBe(11);
    expect(body.myRank).toBe(ownEntry?.rank);
  });

  it("keeps myRank and the displayed list from contradicting each other on ties", async () => {
    // Three users tied on the top balance; the caller is the second of them, so
    // the board shows them at rank 2. Counting "users above me" would say rank 1
    // and contradict the list the user is looking at.
    const table = [
      profile("tie-first", 500),
      profile(AUTH_USER_ID, 500),
      profile("tie-third", 500),
      ...Array.from({ length: 10 }, (_, i) => profile(`below-${i}`, 10)),
    ];

    const { body } = await getBody(table);

    expect(body.myRank).toBe(2);
    // The invariant that matters: myRank always indexes to the caller's own row.
    expect(body.entries[(body.myRank ?? 0) - 1]?.isCurrentUser).toBe(true);
  });

  it("does not look up the balance or count at all when the caller is on the board", async () => {
    const table = [...othersAbove(10, 500), profile(AUTH_USER_ID, 500)];

    const { ownBalanceLookup, gt } = await getBody(table);

    expect(ownBalanceLookup).not.toHaveBeenCalled();
    expect(gt).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/leaderboard/global – total reflects the entries returned", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockResolvedValue({ userId: AUTH_USER_ID, email: "lara@example.com" });
  });

  it("reports the real count on a board smaller than a page", async () => {
    const table = [...othersAbove(6, 100), profile(AUTH_USER_ID, 100)];

    const { body } = await getBody(table);

    expect(body.entries).toHaveLength(7);
    expect(body.total).toBe(7);
    // The hardcoded PAGE_SIZE claimed 50 entries on a 7-user board.
    expect(body.total).not.toBe(PAGE_SIZE);
  });

  it("reports 0 for an empty board", async () => {
    const { body } = await getBody([]);

    expect(body.entries).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it("caps at the page size when more users exist", async () => {
    const table = [...othersAbove(80, 100), profile(AUTH_USER_ID, 5)];

    const { body } = await getBody(table);

    expect(body.entries).toHaveLength(PAGE_SIZE);
    expect(body.total).toBe(body.entries.length);
  });
});

describe("GET /api/v1/leaderboard/global – deterministic order on LP ties (#612)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockResolvedValue({ userId: AUTH_USER_ID, email: "lara@example.com" });
  });

  it("orders the board by LP, then account age, then id — never by LP alone", async () => {
    // Postgres gives NO order guarantee among rows tied on the single sort
    // key: two learners on the same balance could swap ranks on every reload.
    // The unique trailing id key is what makes the board stable.
    const { orderCalls } = await getBody([
      profile("tie-a", 100),
      profile(AUTH_USER_ID, 100),
      profile("tie-b", 100),
    ]);

    expect(orderCalls).toEqual([
      ["lp_balance", { ascending: false }],
      ["created_at", { ascending: true }],
      ["id", { ascending: true }],
    ]);
  });
});

describe("GET /api/v1/leaderboard/global – contract kept intact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockResolvedValue({ userId: AUTH_USER_ID, email: "lara@example.com" });
  });

  it("leaks no raw user ids into the entries (data minimisation)", async () => {
    // Display names must not embed the ids here, otherwise this test could only
    // ever catch a leak through the name field.
    const table = [
      profile("secret-id-1", 900, { display_name: "Mia" }),
      profile(AUTH_USER_ID, 500, { display_name: "Lara" }),
      profile("secret-id-2", 100, { display_name: "Ben" }),
    ];

    const { body } = await getBody(table);

    for (const entry of body.entries) {
      expect(entry).not.toHaveProperty("id");
      expect(entry).not.toHaveProperty("userId");
    }
    const serialised = JSON.stringify(body.entries);
    expect(serialised).not.toContain(AUTH_USER_ID);
    expect(serialised).not.toContain("secret-id-1");
    expect(serialised).not.toContain("secret-id-2");
    // "Is this me?" stays a server-side decision.
    expect(body.entries.filter((entry) => entry.isCurrentUser)).toHaveLength(1);
  });

  it("keeps the entry shape the clients read", async () => {
    const table = [
      profile(AUTH_USER_ID, 500, {
        display_name: "Lara",
        avatar_url: "https://example.test/a.png",
        subscription_tier: "pro",
        current_streak: 7,
      }),
    ];

    const { body } = await getBody(table);

    expect(body.entries[0]).toEqual({
      rank: 1,
      displayName: "Lara",
      avatarUrl: "https://example.test/a.png",
      lpBalance: 500,
      tier: "pro",
      currentStreak: 7,
      isCurrentUser: true,
    });
  });

  it("falls back to display defaults for a sparse profile", async () => {
    const table = [
      profile(AUTH_USER_ID, 500, {
        display_name: null,
        avatar_url: null,
        subscription_tier: null,
        current_streak: null,
      }),
    ];

    const { body } = await getBody(table);

    expect(body.entries[0]).toMatchObject({
      displayName: "Lernender",
      avatarUrl: null,
      tier: "free",
      currentStreak: 0,
    });
  });

  it("reports an unknown rank instead of inventing one when the profile row is missing", async () => {
    // Should not happen — getAuthUser upserts a profile row on every request —
    // but a fabricated rank from a fake 0 balance is exactly the old bug.
    const table = [...othersAbove(60, 100)];

    const { response, body } = await getBody(table);

    expect(response.status).toBe(200);
    expect(body.myRank).toBeNull();
    expect(body.entries).toHaveLength(PAGE_SIZE);
  });

  it("returns 401 without a valid token", async () => {
    mockedGetAuthUser.mockResolvedValue(null);
    const { db } = makeDbMock([]);
    mockedCreateDb.mockReturnValue(db);

    const response = await GET(getRequest());

    expect(response.status).toBe(401);
    expect(mockedCreateDb).not.toHaveBeenCalled();
  });

  it("surfaces a database error as a 500", async () => {
    type FailingQuery = { order: () => FailingQuery; limit: () => Promise<unknown> };
    const failingQuery: FailingQuery = {
      order: () => failingQuery,
      limit: async () => ({ data: null, error: { message: "connection lost" } }),
    };
    const from = vi.fn(() => ({ select: () => failingQuery }));
    mockedCreateDb.mockReturnValue({ from } as never);

    const response = await GET(getRequest());
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(500);
    expect(body.message).toContain("connection lost");
  });
});
