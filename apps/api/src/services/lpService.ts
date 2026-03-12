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

  const db = getDb();
  const { data, error } = await db
    .from("profiles")
    .select("lp_balance")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(`spendLp read: ${error.message}`);

  const balance = data?.lp_balance ?? 0;
  if (balance < cost) return { allowed: false, newBalance: balance, cost };

  const newBalance = balance - cost;
  const { error: updateError } = await db
    .from("profiles")
    .update({ lp_balance: newBalance, updated_at: now.toISOString() })
    .eq("id", userId);

  if (updateError) throw new Error(`spendLp update: ${updateError.message}`);

  await db.from("lp_transactions").insert({
    user_id: userId,
    type: "spent",
    amount: -cost,
    reason: feature,
  });

  return { allowed: true, newBalance, cost };
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

  const db = getDb();
  const { data, error } = await db
    .from("profiles")
    .select("lp_balance, lp_earned_today, lp_ads_today, lp_period_start")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(`earnLp read: ${error.message}`);

  const isSameDay = data?.lp_period_start === today;
  const currentBalance = data?.lp_balance ?? 0;
  const earnedToday = isSameDay ? (data?.lp_earned_today ?? 0) : 0;
  const adsToday = isSameDay ? (data?.lp_ads_today ?? 0) : 0;

  let rawGrant = 0;
  let isAdType = false;

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
      isAdType = true;
      rawGrant = 5;
      break;
  }

  if (rawGrant === 0) {
    return { granted: 0, newBalance: currentBalance, capReached: false };
  }

  let granted = rawGrant;
  let capReached = false;

  if (isAdType) {
    const remaining = Math.max(limits.lpAdCapPerDay - adsToday, 0);
    granted = Math.min(rawGrant, remaining);
    if (granted === 0) return { granted: 0, newBalance: currentBalance, capReached: true };
  } else {
    const remaining = Math.max(limits.lpEarnCapPerDay - earnedToday, 0);
    granted = Math.min(rawGrant, remaining);
    if (granted <= 0) return { granted: 0, newBalance: currentBalance, capReached: true };
  }

  const newBalance = currentBalance + granted;
  const { error: updateError } = await db
    .from("profiles")
    .update({
      lp_balance: newBalance,
      lp_earned_today: isAdType ? earnedToday : earnedToday + granted,
      lp_ads_today: isAdType ? adsToday + granted : adsToday,
      lp_period_start: today,
      updated_at: now.toISOString(),
    })
    .eq("id", userId);

  if (updateError) throw new Error(`earnLp update: ${updateError.message}`);

  await db.from("lp_transactions").insert({
    user_id: userId,
    type: isAdType ? "ad_reward" : "earned",
    amount: granted,
    reason: type,
  });

  return { granted, newBalance, capReached };
}

// ─── Monthly Grant (called by cron / reset-ai-usage function) ────────────────

export async function grantMonthlyLp(userId: string, tier: SubscriptionTier): Promise<number> {
  const grant = getLimitsForTier(tier).lpGrantPerMonth;
  if (grant <= 0) return 0;

  const db = getDb();
  const { data, error } = await db
    .from("profiles")
    .select("lp_balance")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(`grantMonthlyLp read: ${error.message}`);

  const newBalance = (data?.lp_balance ?? 0) + grant;
  await db.from("profiles").update({ lp_balance: newBalance }).eq("id", userId);

  await db.from("lp_transactions").insert({
    user_id: userId,
    type: "abo_grant",
    amount: grant,
    reason: `monthly_${tier}`,
  });

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

  const { data, error } = await db
    .from("profiles")
    .select("lp_balance")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`claimMilestoneReward read: ${error.message}`);

  const newBalance = (data?.lp_balance ?? 0) + lp;
  await db.from("profiles").update({ lp_balance: newBalance }).eq("id", userId);

  await db.from("lp_transactions").insert({
    user_id: userId,
    type: "earned",
    amount: lp,
    reason: `milestone_${milestone}`,
  });

  return { granted: lp, alreadyClaimed: false };
}

// ─── Grant Add-on Pack (after successful purchase) ───────────────────────────

export async function grantLpPurchase(
  userId: string,
  lpAmount: number,
  purchaseId: string
): Promise<number> {
  const db = getDb();
  const { data, error } = await db
    .from("profiles")
    .select("lp_balance")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(`grantLpPurchase read: ${error.message}`);

  const newBalance = (data?.lp_balance ?? 0) + lpAmount;
  await db.from("profiles").update({ lp_balance: newBalance }).eq("id", userId);

  await db.from("lp_transactions").insert({
    user_id: userId,
    type: "purchased",
    amount: lpAmount,
    reason: purchaseId,
  });

  return newBalance;
}
