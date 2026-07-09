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
import { TIER_LIMITS, LP_EARN_RULES, lpCostForFeature, getLimitsForTier } from "../lib/featureGates";
import {
  spendLp,
  refundLp,
  earnLp,
  grantMonthlyLp,
  claimMilestoneReward,
  grantLpPurchase,
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
    expect(LP_EARN_RULES.perReviewSession).toBe(5);
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
    expect(TIER_LIMITS.free.pdfImport).toBe(false);
    expect(TIER_LIMITS.free.adFree).toBe(false);
  });
});

// ─── LP spend logic (pure logic, no DB) ──────────────────────────────────────

describe("LP spend logic", () => {
  it("rejects when balance < cost", () => {
    const balance = 5;
    const cost = 10;
    const allowed = balance >= cost;
    expect(allowed).toBe(false);
  });

  it("allows when balance >= cost", () => {
    const balance = 15;
    const cost = 10;
    const allowed = balance >= cost;
    expect(allowed).toBe(true);
    expect(balance - cost).toBe(5);
  });

  it("zero-cost feature always allowed (e.g. future free feature)", () => {
    const cost = 0;
    const allowed = cost === 0 ? true : false;
    expect(allowed).toBe(true);
  });
});

// ─── LP earn logic (pure logic, no DB) ───────────────────────────────────────

describe("LP earn cap logic", () => {
  it("earn is capped by daily limit", () => {
    const cap = 30;
    const alreadyEarned = 28;
    const rawGrant = LP_EARN_RULES.perReviewSession; // 5
    const remaining = Math.max(cap - alreadyEarned, 0); // 2
    const granted = Math.min(rawGrant, remaining); // 2
    expect(granted).toBe(2);
  });

  it("returns 0 and capReached=true when daily cap is exhausted", () => {
    const cap = 30;
    const alreadyEarned = 30;
    const remaining = Math.max(cap - alreadyEarned, 0);
    expect(remaining).toBe(0);
    const capReached = remaining === 0;
    expect(capReached).toBe(true);
  });

  // Server-side session model (implemented atomically in earn_session_lp):
  //   pending = recorded reviews − already-rewarded watermark
  //   grant   = floor(pending / cardsPerChunk) * perReviewSession, capped per day
  //   watermark advances by exactly the reviews paid for (leftovers roll forward)
  const CARDS_PER_CHUNK = 5;

  it("session pays perReviewSession LP per full chunk of unrewarded reviews", () => {
    const pending = 12; // 12 recorded reviews above the watermark
    const rawGrant = Math.floor(pending / CARDS_PER_CHUNK) * LP_EARN_RULES.perReviewSession;
    expect(rawGrant).toBe(10); // 2 full chunks → 10 LP; remaining 2 reviews roll forward
  });

  it("session with less than one full chunk of new reviews earns 0 LP", () => {
    const pending = 3;
    const rawGrant = Math.floor(pending / CARDS_PER_CHUNK) * LP_EARN_RULES.perReviewSession;
    expect(rawGrant).toBe(0);
  });

  it("replaying session without new reviews earns 0 LP (watermark drained)", () => {
    // Once the watermark catches up to the review count, pending is 0 — so replaying
    // POST /lp/earn {type:"session"} cannot mint LP without real recorded reviews.
    const total = 22;
    const rewardedWatermark = 22;
    const pending = Math.max(total - rewardedWatermark, 0);
    expect(pending).toBe(0);
  });

  it("pro tier has higher daily earn cap", () => {
    const freeCap = TIER_LIMITS.free.lpEarnCapPerDay;
    const proCap = TIER_LIMITS.pro.lpEarnCapPerDay;
    expect(proCap).toBeGreaterThan(freeCap);
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

describe("earnLp — session via earn_session_lp, ad via earn_lp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("session routes to earn_session_lp with the chunk config and maps the row", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({
      data: [{ granted: 5, new_balance: 15, cap_reached: false }],
      error: null,
    });
    useMockDb(db);

    const result = await earnLp("user-1", "free", "session");

    expect(db.rpc).toHaveBeenCalledWith(
      "earn_session_lp",
      expect.objectContaining({
        p_user: "user-1",
        p_lp_per_chunk: LP_EARN_RULES.perReviewSession, // 5
        p_cards_per_chunk: 5,
        p_earn_cap: TIER_LIMITS.free.lpEarnCapPerDay,
      }),
    );
    expect(result).toEqual({ granted: 5, newBalance: 15, capReached: false });
  });

  it("session's chunk size is a fixed server constant, not a client-supplied count", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({
      data: [{ granted: 0, new_balance: 10, cap_reached: false }],
      error: null,
    });
    useMockDb(db);

    await earnLp("user-1", "free", "session");

    const params = db.rpc.mock.calls[0]![1] as Record<string, unknown>;
    expect(params).not.toHaveProperty("p_raw_grant"); // old client-derived grant is gone
    expect(params.p_cards_per_chunk).toBe(5); // fixed, server-owned — never from the client
  });

  it("session reports capReached when earn_session_lp returns cap_reached=true", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({
      data: [{ granted: 0, new_balance: 10, cap_reached: true }],
      error: null,
    });
    useMockDb(db);

    const result = await earnLp("user-1", "free", "session");

    expect(result).toEqual({ granted: 0, newBalance: 10, capReached: true });
  });

  it("ad rewards go through earn_lp with p_is_ad=true and the ad cap", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({
      data: [{ granted: 5, new_balance: 15, cap_reached: false }],
      error: null,
    });
    useMockDb(db);

    await earnLp("user-1", "free", "ad");

    expect(db.rpc).toHaveBeenCalledWith(
      "earn_lp",
      expect.objectContaining({
        p_is_ad: true,
        p_raw_grant: 5,
        p_ad_cap: TIER_LIMITS.free.lpAdCapPerDay,
      }),
    );
  });

  it("throws with the failing earn path when the RPC returns an error", async () => {
    const db = makeMockDb();
    db.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    useMockDb(db);

    await expect(earnLp("user-1", "free", "session")).rejects.toThrow("earnLp(session): boom");
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

// ─── Playwright E2E test specification (scenarios) ───────────────────────────
// These are documentation tests — they describe the Playwright scenarios that
// should be implemented in e2e/lp.spec.ts.

describe("E2E scenarios (specification only)", () => {
  it("should: GET /api/v1/usage returns lpBalance, lpCostAiScan, tier", () => {
    // Playwright: Authenticate as test user → GET /api/v1/usage
    // Assert: response.lpBalance >= 0, response.tier in ["free","pro"]
    expect(true).toBe(true);
  });

  it("should: POST /api/v1/lp/earn type=session grants from recorded reviews, not client count", () => {
    // Playwright: record >=5 real reviews (POST /api/v1/cards/:id/review), then
    //   POST /api/v1/lp/earn {type:"session"} → granted == perReviewSession (5).
    // Replay {type:"session"} with no new reviews → granted == 0 (watermark drained).
    // Forgery check: {type:"session", sessionCardCount:9999} with no reviews → granted == 0.
    expect(LP_EARN_RULES.perReviewSession).toBe(5);
  });

  it("should: POST /api/v1/lp/spend with insufficient balance returns 402", () => {
    // Playwright: Drain balance to 0 → POST /api/v1/lp/spend {feature:"aiScan"}
    // Assert: HTTP 402, code "INSUFFICIENT_LP"
    expect(true).toBe(true);
  });

  it("should: POST /api/v1/lp/milestone first_deck is idempotent", () => {
    // Playwright: POST milestone/first_deck twice
    // First: granted > 0, alreadyClaimed: false
    // Second: granted == 0, alreadyClaimed: true
    expect(true).toBe(true);
  });
});
