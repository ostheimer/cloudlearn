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

// ─── Earn ─────────────────────────────────────────────────────────────────────

export type EarnType = "session" | "dailyGoal" | "ad";

export interface EarnResult {
  granted: number;
  newBalance: number;
  capReached: boolean;
}

export async function earnLp(
  userId: string,
  tier: SubscriptionTier,
  type: EarnType,
  sessionCardCount?: number,
  now = new Date()
): Promise<EarnResult> {
  const limits = getLimitsForTier(tier);
  const today = now.toISOString().split("T")[0]!;

  // Business rule (kept in TS): how much this event is worth before caps.
  let rawGrant = 0;
  let isAd = false;

  switch (type) {
    case "session": {
      const count = sessionCardCount ?? 0;
      rawGrant = count >= 5 ? LP_EARN_RULES.perReviewSession : 0;
      break;
    }
    case "dailyGoal":
      rawGrant = LP_EARN_RULES.dailyGoalBonus;
      break;
    case "ad":
      isAd = true;
      rawGrant = 5;
      break;
  }

  // Atomic earn: the day-reset, per-day cap check, balance credit and ledger
  // insert all happen under a single row lock inside earn_lp. We deliberately
  // do NOT early-return on rawGrant<=0 — the SQL handles that and returns the
  // correct current balance.
  const db = getDb();
  const { data, error } = await db.rpc("earn_lp", {
    p_user: userId,
    p_raw_grant: rawGrant,
    p_is_ad: isAd,
    p_earn_cap: limits.lpEarnCapPerDay,
    p_ad_cap: limits.lpAdCapPerDay,
    p_type: type,
    p_today: today,
  });

  if (error) throw new Error(`earnLp: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  return {
    granted: row?.granted ?? 0,
    newBalance: row?.new_balance ?? 0,
    capReached: row?.cap_reached ?? false,
  };
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

  const { error: insertError } = await db.from("rewards_claimed").insert({
    user_id: userId,
    reward_key: milestone,
    lp_granted: lp,
  });

  if (insertError) {
    return { granted: 0, alreadyClaimed: true };
  }

  const { error } = await db.rpc("add_lp", {
    p_user: userId,
    p_amount: lp,
    p_type: "earned",
    p_reason: `milestone_${milestone}`,
  });
  if (error) throw new Error(`claimMilestoneReward: ${error.message}`);

  return { granted: lp, alreadyClaimed: false };
}

// ─── Grant Add-on Pack (after successful purchase) ───────────────────────────

export async function grantLpPurchase(
  userId: string,
  lpAmount: number,
  purchaseId: string
): Promise<number> {
  const db = getDb();
  const { data, error } = await db.rpc("add_lp", {
    p_user: userId,
    p_amount: lpAmount,
    p_type: "purchased",
    p_reason: purchaseId,
  });

  if (error) throw new Error(`grantLpPurchase: ${error.message}`);

  return (data as number | null) ?? 0;
}
