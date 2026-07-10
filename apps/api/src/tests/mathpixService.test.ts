import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Mathpix budget is now persisted in Supabase Postgres (`mathpix_usage`),
 * consumed via the atomic `consume_mathpix_cost` RPC. We mock the admin client
 * with a tiny in-memory fake so these unit tests exercise the real accumulate /
 * budget / fail-open logic without a live database.
 */
const { store, makeClient, mockCreateAdmin } = vi.hoisted(() => {
  const store = new Map<string, number>();

  const makeClient = () => ({
    // Mirrors consume_mathpix_cost: adds the cost and returns the new total.
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn !== "consume_mathpix_cost") {
        return { data: null, error: { message: `unexpected rpc ${fn}` } };
      }
      const user = args.p_user as string;
      const cost = args.p_cost as number;
      const next = (store.get(user) ?? 0) + cost;
      store.set(user, next);
      return { data: next, error: null };
    },
    // Mirrors: select("spent_usd").eq("user_id", id).maybeSingle()
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, value: string) => ({
          maybeSingle: async () => {
            const spent = store.get(value);
            return spent === undefined
              ? { data: null, error: null }
              : { data: { spent_usd: spent }, error: null };
          },
        }),
      }),
    }),
  });

  const mockCreateAdmin = vi.fn();
  return { store, makeClient, mockCreateAdmin };
});

vi.mock("@/lib/supabase", () => ({
  createSupabaseAdminClient: mockCreateAdmin,
}));

import {
  canProcessMathpix,
  consumeMathpixCost,
  getMathpixSpend,
  resetMathpixCosts,
} from "@/services/mathpixService";

const userId = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";

describe("mathpixService — persistent per-user budget", () => {
  beforeEach(() => {
    store.clear();
    mockCreateAdmin.mockReset();
    mockCreateAdmin.mockImplementation(() => makeClient());
  });

  it("accumulates spend across the persistent store and enforces the budget", async () => {
    for (let i = 0; i < 3; i += 1) {
      await consumeMathpixCost(userId);
    }
    expect(await getMathpixSpend(userId)).toBeCloseTo(0.006, 5);
    expect(await canProcessMathpix(userId, 0.001)).toBe(false);
  });

  it("returns the new running total from each atomic consume", async () => {
    expect(await consumeMathpixCost(userId)).toBeCloseTo(0.002, 5);
    expect(await consumeMathpixCost(userId)).toBeCloseTo(0.004, 5);
  });

  it("allows a fresh user under the default budget", async () => {
    expect(await getMathpixSpend(userId)).toBe(0);
    expect(await canProcessMathpix(userId)).toBe(true);
  });

  it("fails open (spend 0, allowed) when the DB client is unavailable", async () => {
    mockCreateAdmin.mockReturnValue(null);
    expect(await getMathpixSpend(userId)).toBe(0);
    expect(await consumeMathpixCost(userId)).toBe(0);
    expect(await canProcessMathpix(userId)).toBe(true);
  });

  it("keeps resetMathpixCosts as an awaitable no-op", async () => {
    await expect(resetMathpixCosts()).resolves.toBeUndefined();
  });
});
