/**
 * Unit tests for the LP (Lernpunkte) system.
 *
 * These tests use a mock Supabase client and verify the business logic of
 * spendLp, earnLp, claimMilestoneReward, and grantMonthlyLp independently
 * of a live database.
 *
 * They also serve as the specification for Playwright E2E tests that should
 * verify the same scenarios through the HTTP API.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TIER_LIMITS, LP_EARN_RULES, lpCostForFeature, getLimitsForTier, STREAK_FREEZE, STREAK_REPAIR } from "../lib/featureGates";
import {
  spendLp,
  refundLp,
  earnLp,
  grantMonthlyLp,
  claimMilestoneReward,
  grantLpPurchase,
  purchaseStreakFreeze,
  purchaseStreakRepair,
} from "@/services/lpService";
import { createSupabaseAdminClient } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

// Mock Supabase client exposing the atomic RPCs (spend_lp / earn_lp / add_lp /
// claim_milestone_lp). Every LP mutation now goes through an RPC, so the old
// from(...).insert(...) chain (previously the rewards_claimed guard) is gone.
function makeMockDb() {
  const rpc = vi.fn();
  return { rpc };
}

function useMockDb(db: ReturnType<typeof makeMockDb>) {
  vi.mocked(createSupabaseAdminClient).mockReturnValue(db as never);
}

// ─── featureGates unit tests (no DB required) ─────────────────────────────────

describe("featureGates – LP economy", () => {
  it("free tier has correct LP costs", () => {
    expect(TIER_LIMITS.free.lpCostAiScan).toBe(10);
    expect(TIER_LIMITS.free.lpCostUrlImport).toBe(15);
    expect(TIER_LIMITS.free.lpCostPdfImport).toBe(20);
  });

  it("pro tier has discounted LP costs vs free", () => {
    expect(TIER_LIMITS.pro.lpCostAiScan).toBeLessThan(TIER_LIMITS.free.lpCostAiScan);
    expect(TIER_LIMITS.pro.lpCostUrlImport).toBeLessThan(TIER_LIMITS.free.lpCostUrlImport);
    expect(TIER_LIMITS.pro.lpCostPdfImport).toBeLessThan(TIER_LIMITS.free.lpCostPdfImport);
  });

  it("pro tier grants monthly LP, free tier does not", () => {
    expect(TIER_LIMITS.pro.lpGrantPerMonth).toBeGreaterThan(0);
    expect(TIER_LIMITS.free.lpGrantPerMonth).toBe(0);
  });

  it("free tier has ad LP cap, pro has none", () => {
    expect(TIER_LIMITS.free.lpAdCapPerDay).toBeGreaterThan(0);
    expect(TIER_LIMITS.pro.lpAdCapPerDay).toBe(0);
  });

  it("pro tier has higher earn cap per day than free", () => {
    expect(TIER_LIMITS.pro.lpEarnCapPerDay).toBeGreaterThan(TIER_LIMITS.free.lpEarnCapPerDay);
  });

  it("lpCostForFeature returns correct values", () => {
    expect(lpCostForFeature("free", "aiScan")).toBe(10);
    expect(lpCostForFeature("free", "urlImport")).toBe(15);
    expect(lpCostForFeature("pro", "aiScan")).toBe(5);
  });

  it("LP_EARN_RULES are defined and sensible", () => {
    // 1 LP per reviewed card (chunk size 1). Was 5 LP per 5-card chunk, which
    // paid 0 for a 3-card session and deferred the remainder.
    expect(LP_EARN_RULES.perReviewSession).toBe(1);
    expect(LP_EARN_RULES.dailyGoalBonus).toBe(10);
    expect(LP_EARN_RULES.streakDay7).toBe(25);
    expect(LP_EARN_RULES.streakDay30).toBe(100);
    expect(LP_EARN_RULES.streakDay100).toBe(300);
    expect(LP_EARN_RULES.referralSender).toBeGreaterThan(0);
    expect(LP_EARN_RULES.referralReceiver).toBeGreaterThan(0);
  });

  it("milestone streak bonuses increase with streak length", () => {
    expect(LP_EARN_RULES.streakDay7).toBeLessThan(LP_EARN_RULES.streakDay30);
    expect(LP_EARN_RULES.streakDay30).toBeLessThan(LP_EARN_RULES.streakDay100);
  });

  it("getLimitsForTier returns correct object for each tier", () => {
    expect(getLimitsForTier("free")).toBe(TIER_LIMITS.free);
    expect(getLimitsForTier("pro")).toBe(TIER_LIMITS.pro);
    expect(getLimitsForTier("lifetime")).toBe(TIER_LIMITS.lifetime);
  });

  it("free, pro and lifetime tiers exist", () => {
    expect(Object.keys(TIER_LIMITS)).toEqual(["free", "pro", "lifetime"]);
  });

  it("pro tier has premium features enabled", () => {
    expect(TIER_LIMITS.pro.pdfImport).toBe(true);
    expect(TIER_LIMITS.pro.imageOcclusion).toBe(true);
    expect(TIER_LIMITS.pro.offlineDownload).toBe(true);
    expect(TIER_LIMITS.pro.advancedStats).toBe(true);
    expect(TIER_LIMITS.pro.adFree).toBe(true);
  });

  it("lifetime tier has premium features enabled", () => {
    expect(TIER_LIMITS.lifetime.pdfImport).toBe(true);
    expect(TIER_LIMITS.lifetime.imageOcclusion).toBe(true);
    expect(TIER_LIMITS.lifetime.offlineDownload).toBe(true);
    expect(TIER_LIMITS.lifetime.advancedStats).toBe(true);
    expect(TIER_LIMITS.lifetime.adFree).toBe(true);
  });

  it("free tier has premium features disabled", () => {
    expect(TIER_LIMITS.free.adFree).toBe(false);
  });

  it("pdf import is available on every tier, priced in LP (#84)", () => {
    expect(TIER_LIMITS.free.pdfImport).toBe(true);
    expect(TIER_LIMITS.free.lpCostPdfImport).toBeGreaterThan(0);
  });
});

// ─── lpService against atomic RPCs (mocked Supabase client) ──────────────────
// These exercise the real service functions and assert they call the atomic
// Postgres functions (spend_lp / earn_lp / add_lp) with the right params and
// correctly map the returned rows/scalars back to the public return shapes.

describe("spendLp (atomic spend_lp RPC)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows and returns new balance when spend_lp reports success", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({ data: [{ allowed: true, new_balance: 5 }], error: null });
    useMockDb(db);

    const result = await spendLp("user-1", "free", "aiScan");

    expect(db.rpc).toHaveBeenCalledWith("spend_lp", {
      p_user: "user-1",
      p_cost: TIER_LIMITS.free.lpCostAiScan, // 10
      p_reason: "aiScan",
    });
    expect(result).toEqual({ allowed: true, newBalance: 5, cost: 10 });
  });

  it("rejects (allowed=false) when spend_lp reports insufficient balance", async () => {
    const db = makeMockDb();
    // balance 5 < cost 10 → SQL leaves balance untouched and returns allowed=false
    db.rpc.mockResolvedValue({ data: [{ allowed: false, new_balance: 5 }], error: null });
    useMockDb(db);

    const result = await spendLp("user-1", "free", "aiScan");

    expect(result).toEqual({ allowed: false, newBalance: 5, cost: 10 });
  });

  it("passes tier-specific cost to the RPC (pro is discounted)", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({ data: [{ allowed: true, new_balance: 20 }], error: null });
    useMockDb(db);

    await spendLp("user-1", "pro", "urlImport");

    expect(db.rpc).toHaveBeenCalledWith("spend_lp", {
      p_user: "user-1",
      p_cost: TIER_LIMITS.pro.lpCostUrlImport, // 8
      p_reason: "urlImport",
    });
  });

  it("throws when the RPC returns an error", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    useMockDb(db);

    await expect(spendLp("user-1", "free", "aiScan")).rejects.toThrow("spendLp: boom");
  });
});

describe("purchaseStreakFreeze (atomic purchase_streak_freeze RPC)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes the server-side price and cap, maps a successful purchase", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({
      data: [{ allowed: true, error_code: null, new_balance: 10, freezes: 1 }],
      error: null,
    });
    useMockDb(db);

    const result = await purchaseStreakFreeze("user-1");

    expect(db.rpc).toHaveBeenCalledWith("purchase_streak_freeze", {
      p_user: "user-1",
      p_cost: STREAK_FREEZE.costLp,
      p_max: STREAK_FREEZE.maxOwned,
    });
    expect(result).toEqual({
      allowed: true,
      errorCode: null,
      newBalance: 10,
      freezes: 1,
      cost: STREAK_FREEZE.costLp,
    });
  });

  it("maps a rejection with its error code (insufficient LP)", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({
      data: [{ allowed: false, error_code: "insufficient_lp", new_balance: 5, freezes: 0 }],
      error: null,
    });
    useMockDb(db);

    const result = await purchaseStreakFreeze("user-1");

    expect(result.allowed).toBe(false);
    expect(result.errorCode).toBe("insufficient_lp");
    expect(result.newBalance).toBe(5);
  });

  it("maps a rejection at the ownership cap", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({
      data: [{ allowed: false, error_code: "max_owned", new_balance: 100, freezes: 2 }],
      error: null,
    });
    useMockDb(db);

    const result = await purchaseStreakFreeze("user-1");

    expect(result.allowed).toBe(false);
    expect(result.errorCode).toBe("max_owned");
    expect(result.freezes).toBe(2);
  });

  it("throws when the RPC returns an error", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    useMockDb(db);

    await expect(purchaseStreakFreeze("user-1")).rejects.toThrow("purchaseStreakFreeze: boom");
  });
});

describe("purchaseStreakRepair (atomic purchase_streak_repair RPC)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes the server price + local day, maps a successful repair", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({
      data: [{ allowed: true, error_code: null, new_balance: 60, new_streak: 13 }],
      error: null,
    });
    useMockDb(db);

    const result = await purchaseStreakRepair("user-1");

    expect(db.rpc).toHaveBeenCalledWith("purchase_streak_repair", expect.objectContaining({
      p_user: "user-1",
      p_cost: STREAK_REPAIR.costLp,
    }));
    expect(result).toMatchObject({ allowed: true, errorCode: null, newBalance: 60, newStreak: 13, cost: STREAK_REPAIR.costLp });
  });

  it("maps a rejection when there is nothing to repair", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({
      data: [{ allowed: false, error_code: "no_repair", new_balance: 100, new_streak: 3 }],
      error: null,
    });
    useMockDb(db);

    const result = await purchaseStreakRepair("user-1");
    expect(result.allowed).toBe(false);
    expect(result.errorCode).toBe("no_repair");
  });

  it("throws when the RPC returns an error", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    useMockDb(db);

    await expect(purchaseStreakRepair("user-1")).rejects.toThrow("purchaseStreakRepair: boom");
  });
});

describe("earnLp — session only, via earn_session_lp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("routes to earn_session_lp with the chunk config and maps the row", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({
      data: [{ granted: 5, new_balance: 15, cap_reached: false }],
      error: null,
    });
    useMockDb(db);

    const result = await earnLp("user-1", "free");

    expect(db.rpc).toHaveBeenCalledWith(
      "earn_session_lp",
      expect.objectContaining({
        p_user: "user-1",
        p_lp_per_chunk: LP_EARN_RULES.perReviewSession, // 1
        p_cards_per_chunk: 1,
        p_earn_cap: TIER_LIMITS.free.lpEarnCapPerDay,
      }),
    );
    expect(result).toEqual({ granted: 5, newBalance: 15, capReached: false });
  });

  it("the chunk size is a fixed server constant, not a client-supplied count", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({
      data: [{ granted: 0, new_balance: 10, cap_reached: false }],
      error: null,
    });
    useMockDb(db);

    await earnLp("user-1", "free");

    const params = db.rpc.mock.calls[0]![1] as Record<string, unknown>;
    expect(params).not.toHaveProperty("p_raw_grant"); // old client-derived grant is gone
    expect(params.p_cards_per_chunk).toBe(1); // fixed, server-owned — never from the client
  });

  it("reports capReached when earn_session_lp returns cap_reached=true", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({
      data: [{ granted: 0, new_balance: 10, cap_reached: true }],
      error: null,
    });
    useMockDb(db);

    const result = await earnLp("user-1", "free");

    expect(result).toEqual({ granted: 0, newBalance: 10, capReached: true });
  });

  it("never touches the ad path (no earn_lp / p_is_ad) — ad self-grant is retired", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({
      data: [{ granted: 5, new_balance: 15, cap_reached: false }],
      error: null,
    });
    useMockDb(db);

    await earnLp("user-1", "free");

    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith("earn_session_lp", expect.anything());
    const params = db.rpc.mock.calls[0]![1] as Record<string, unknown>;
    expect(params).not.toHaveProperty("p_is_ad");
  });

  it("throws with the failing earn path when the RPC returns an error", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    useMockDb(db);

    await expect(earnLp("user-1", "free")).rejects.toThrow("earnLp(session): boom");
  });
});

describe("grantMonthlyLp (atomic add_lp RPC)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("credits the monthly grant for pro and returns the grant amount", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({ data: 400, error: null });
    useMockDb(db);

    const result = await grantMonthlyLp("user-1", "pro");

    expect(db.rpc).toHaveBeenCalledWith("add_lp", {
      p_user: "user-1",
      p_amount: TIER_LIMITS.pro.lpGrantPerMonth, // 300
      p_type: "abo_grant",
      p_reason: "monthly_pro",
    });
    expect(result).toBe(TIER_LIMITS.pro.lpGrantPerMonth);
  });

  it("does nothing and returns 0 for free tier (no grant)", async () => {
    const db = makeMockDb();
    useMockDb(db);

    const result = await grantMonthlyLp("user-1", "free");

    expect(result).toBe(0);
    expect(db.rpc).not.toHaveBeenCalled();
  });
});

describe("claimMilestoneReward (atomic claim_milestone_lp RPC)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("grants the milestone LP on first claim via the atomic RPC", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({
      data: [{ granted: LP_EARN_RULES.firstDeck, already_claimed: false, new_balance: 20 }],
      error: null,
    });
    useMockDb(db);

    const result = await claimMilestoneReward("user-1", "first_deck");

    // Guard + credit are now one atomic call — not a separate from().insert() then add_lp.
    expect(db.rpc).toHaveBeenCalledWith("claim_milestone_lp", {
      p_user: "user-1",
      p_reward_key: "first_deck",
      p_amount: LP_EARN_RULES.firstDeck, // 10
    });
    expect(result).toEqual({ granted: LP_EARN_RULES.firstDeck, alreadyClaimed: false });
  });

  it("is idempotent: a repeat claim grants 0 and reports alreadyClaimed", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({
      data: [{ granted: 0, already_claimed: true, new_balance: 20 }],
      error: null,
    });
    useMockDb(db);

    const result = await claimMilestoneReward("user-1", "first_deck");

    expect(result).toEqual({ granted: 0, alreadyClaimed: true });
  });

  it("throws when the RPC returns an error (credit never silently lost)", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    useMockDb(db);

    await expect(claimMilestoneReward("user-1", "first_deck")).rejects.toThrow(
      "claimMilestoneReward: boom"
    );
  });
});

describe("grantLpPurchase (idempotent grant_lp_purchase RPC)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("credits the purchased LP via the idempotent RPC and returns the balance", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({
      data: [{ granted: 100, already_granted: false, new_balance: 110 }],
      error: null,
    });
    useMockDb(db);

    const result = await grantLpPurchase("user-1", 100, "purchase-abc");

    expect(db.rpc).toHaveBeenCalledWith("grant_lp_purchase", {
      p_user: "user-1",
      p_amount: 100,
      p_reason: "purchase-abc",
    });
    expect(result).toBe(110);
  });

  it("is idempotent: a duplicate delivery grants 0 and returns the unchanged balance", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({
      data: [{ granted: 0, already_granted: true, new_balance: 110 }],
      error: null,
    });
    useMockDb(db);

    const result = await grantLpPurchase("user-1", 100, "purchase-abc");

    // Same transaction booked twice → balance stays put, no double credit.
    expect(result).toBe(110);
  });

  it("returns 0 when the RPC reports no matching profile (null balance)", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({ data: [{ granted: 0, already_granted: false, new_balance: null }], error: null });
    useMockDb(db);

    const result = await grantLpPurchase("user-1", 100, "purchase-abc");

    expect(result).toBe(0);
  });

  it("throws when the RPC returns an error", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    useMockDb(db);

    await expect(grantLpPurchase("user-1", 100, "purchase-abc")).rejects.toThrow(
      "grantLpPurchase: boom"
    );
  });
});

describe("refundLp (atomic add_lp RPC with 'refund' type)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("credits the refund via add_lp under the dedicated 'refund' type", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({ data: 25, error: null });
    useMockDb(db);

    const result = await refundLp("user-1", 20, "refund_pdfImport_failed");

    expect(db.rpc).toHaveBeenCalledWith("add_lp", {
      p_user: "user-1",
      p_amount: 20,
      p_type: "refund",
      p_reason: "refund_pdfImport_failed",
    });
    expect(result).toBe(25);
  });

  it("is a no-op for non-positive amounts (never touches the DB)", async () => {
    const db = makeMockDb();
    useMockDb(db);

    expect(await refundLp("user-1", 0, "refund_pdfImport_failed")).toBe(0);
    expect(await refundLp("user-1", -5, "refund_pdfImport_failed")).toBe(0);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("returns 0 when add_lp reports no matching profile (null scalar)", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({ data: null, error: null });
    useMockDb(db);

    expect(await refundLp("user-1", 20, "refund_pdfImport_failed")).toBe(0);
  });

  it("throws when add_lp reports an error", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    useMockDb(db);

    await expect(refundLp("user-1", 20, "refund_pdfImport_failed")).rejects.toThrow(
      "refundLp: boom"
    );
  });
});
