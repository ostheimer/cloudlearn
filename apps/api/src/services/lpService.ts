import { createSupabaseAdminClient } from "@/lib/supabase";
import { getLimitsForTier, LP_EARN_RULES, lpCostForFeature } from "@/lib/featureGates";
import type { SubscriptionTier } from "@/lib/contracts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDb() {
  const client = createSupabaseAdminClient();
  if (!client) {
    throw new Error("Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return client;
}

function todayUTC(): string {
  return new Date().toISOString().split("T")[0]!;
}

// ─── Balance ─────────────────────────────────────────────────────────────────

export interface LpProfile {
  balance: number;
  earnedToday: number;
  adsToday: number;
  lpPeriodStart: string;
}

export async function getLpProfile(userId: string): Promise<LpProfile> {
  const db = getDb();
  const { data, error } = await db
    .from("profiles")
    .select("lp_balance, lp_earned_today, lp_ads_today, lp_period_start")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(`getLpProfile: ${error.message}`);

  const today = todayUTC();
  const isSameDay = data?.lp_period_start === today;
  return {
    balance: data?.lp_balance ?? 10,
    earnedToday: isSameDay ? (data?.lp_earned_today ?? 0) : 0,
    adsToday: isSameDay ? (data?.lp_ads_today ?? 0) : 0,
    lpPeriodStart: data?.lp_period_start ?? today,
  };
}

// ─── Spend ────────────────────────────────────────────────────────────────────

export async function spendLp(
  userId: string,
  tier: SubscriptionTier,
  feature: "aiScan" | "urlImport" | "pdfImport",
  now = new Date()
): Promise<{ allowed: boolean; newBalance: number; cost: number }> {
  const cost = lpCostForFeature(tier, feature);
  if (cost === 0) return { allowed: true, newBalance: -1, cost: 0 };

  // Atomic conditional spend: the balance check and deduction happen inside a
  // single Postgres statement (see spend_lp), so concurrent requests cannot
  // double-spend by both reading the same balance.
  const db = getDb();
  const { data, error } = await db.rpc("spend_lp", {
    p_user: userId,
    p_cost: cost,
    p_reason: feature,
  });

  if (error) throw new Error(`spendLp: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: row?.allowed ?? false,
    newBalance: row?.new_balance ?? 0,
    cost,
  };
}

// ─── Refund ───────────────────────────────────────────────────────────────────

/**
 * Credits LP back to a user after a charged operation failed to produce any
 * result — e.g. a paid PDF import whose text extraction threw, or an image scan
 * the AI couldn't turn into cards. Because spend_lp runs before processing, a
 * failure would otherwise leave the user billed for cards that never existed.
 *
 * Uses the atomic add_lp credit and records the reversal under the dedicated
 * `refund` ledger type (see 20260708120000_add_refund_lp_type.sql) so the audit
 * trail stays honest. Amounts <= 0 are a no-op — nothing was charged, nothing to
 * give back. Returns the new balance, or 0 if the profile no longer exists.
 */
export async function refundLp(
  userId: string,
  amount: number,
  reason: string
): Promise<number> {
  if (amount <= 0) return 0;

  const db = getDb();
  const { data, error } = await db.rpc("add_lp", {
    p_user: userId,
    p_amount: amount,
    p_type: "refund",
    p_reason: reason,
  });

  if (error) throw new Error(`refundLp: ${error.message}`);

  return (data as number | null) ?? 0;
}

// ─── Earn ─────────────────────────────────────────────────────────────────────

// "dailyGoal" was removed: no legitimate client ever sent it, so it was pure
// attack surface (10 free LP per call). The two real earn paths are:
//   - "session": grant is derived from server-recorded reviews (review_logs),
//     never from a client-supplied count — see earn_session_lp.
//   - "ad":      still a flat 5 LP; binding it to AdMob SSV is tracked separately.
export type EarnType = "session" | "ad";

export interface EarnResult {
  granted: number;
  newBalance: number;
  capReached: boolean;
}

// Number of reviewed cards that make up one rewardable "session" chunk.
const CARDS_PER_SESSION_CHUNK = 5;
const LP_PER_AD = 5;

function mapEarnRow(data: unknown): EarnResult {
  const row = Array.isArray(data) ? data[0] : data;
  const r = row as { granted?: number; new_balance?: number; cap_reached?: boolean } | null;
  return {
    granted: r?.granted ?? 0,
    newBalance: r?.new_balance ?? 0,
    capReached: r?.cap_reached ?? false,
  };
}

export async function earnLp(
  userId: string,
  tier: SubscriptionTier,
  type: EarnType
): Promise<EarnResult> {
  const limits = getLimitsForTier(tier);
  const today = todayUTC();
  const db = getDb();

  if (type === "ad") {
    // Atomic earn under the ad/day cap. (Ad legitimacy — AdMob SSV — is a
    // separate follow-up; today the grant is still a flat amount.)
    const { data, error } = await db.rpc("earn_lp", {
      p_user: userId,
      p_raw_grant: LP_PER_AD,
      p_is_ad: true,
      p_earn_cap: limits.lpEarnCapPerDay,
      p_ad_cap: limits.lpAdCapPerDay,
      p_type: "ad",
      p_today: today,
    });
    if (error) throw new Error(`earnLp(ad): ${error.message}`);
    return mapEarnRow(data);
  }

  // session — the SQL counts the user's real, not-yet-rewarded reviews and pays
  // only for whole chunks up to the daily cap, all atomically. The client's
  // claimed card count is intentionally ignored.
  const { data, error } = await db.rpc("earn_session_lp", {
    p_user: userId,
    p_lp_per_chunk: LP_EARN_RULES.perReviewSession,
    p_cards_per_chunk: CARDS_PER_SESSION_CHUNK,
    p_earn_cap: limits.lpEarnCapPerDay,
    p_today: today,
  });
  if (error) throw new Error(`earnLp(session): ${error.message}`);
  return mapEarnRow(data);
}

// ─── Monthly Grant (called by cron / reset-ai-usage function) ────────────────

export async function grantMonthlyLp(userId: string, tier: SubscriptionTier): Promise<number> {
  const grant = getLimitsForTier(tier).lpGrantPerMonth;
  if (grant <= 0) return 0;

  const db = getDb();
  const { error } = await db.rpc("add_lp", {
    p_user: userId,
    p_amount: grant,
    p_type: "abo_grant",
    p_reason: `monthly_${tier}`,
  });

  if (error) throw new Error(`grantMonthlyLp: ${error.message}`);

  return grant;
}

// ─── Milestone Reward (idempotent) ───────────────────────────────────────────

export type MilestoneKey =
  | "first_deck"
  | "first_review"
  | "streak_7"
  | "streak_30"
  | "streak_100";

const MILESTONE_LP: Record<MilestoneKey, number> = {
  first_deck:    LP_EARN_RULES.firstDeck,
  first_review:  LP_EARN_RULES.firstReview,
  streak_7:      LP_EARN_RULES.streakDay7,
  streak_30:     LP_EARN_RULES.streakDay30,
  streak_100:    LP_EARN_RULES.streakDay100,
};

export async function claimMilestoneReward(
  userId: string,
  milestone: MilestoneKey
): Promise<{ granted: number; alreadyClaimed: boolean }> {
  const lp = MILESTONE_LP[milestone];
  const db = getDb();

  // The idempotency guard (rewards_claimed insert) and the credit run atomically
  // inside claim_milestone_lp — one transaction, all-or-nothing. This closes the
  // window where the old two-round-trip version could mark a reward claimed but
  // fail to credit the LP, losing them permanently on every retry.
  const { data, error } = await db.rpc("claim_milestone_lp", {
    p_user: userId,
    p_reward_key: milestone,
    p_amount: lp,
  });

  if (error) throw new Error(`claimMilestoneReward: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  return {
    granted: row?.granted ?? 0,
    alreadyClaimed: row?.already_claimed ?? false,
  };
}

// ─── Grant Add-on Pack (after successful purchase) ───────────────────────────

export async function grantLpPurchase(
  userId: string,
  lpAmount: number,
  purchaseId: string
): Promise<number> {
  const db = getDb();

  // Idempotent by construction: grant_lp_purchase guards the ledger insert with
  // a partial unique index on the purchase reason, so two webhook deliveries for
  // the same transaction can never double-credit — the second is a no-op. Guard
  // and credit run in one transaction. Returns the resulting balance.
  const { data, error } = await db.rpc("grant_lp_purchase", {
    p_user: userId,
    p_amount: lpAmount,
    p_reason: purchaseId,
  });

  if (error) throw new Error(`grantLpPurchase: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  return row?.new_balance ?? 0;
}
