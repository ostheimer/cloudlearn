import { createSupabaseAdminClient } from "@/lib/supabase";
import { getLimitsForTier, LP_EARN_RULES, lpCostForFeature, STREAK_FREEZE, STREAK_REPAIR } from "@/lib/featureGates";
import { todayLocal } from "@/lib/localDay";
import { getStreakInfo, hasAnyReviewLog } from "@/lib/db";
import { logError } from "@/lib/observability";
import type { MilestoneAward, MilestoneKey, SubscriptionTier } from "@/lib/contracts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDb() {
  const client = createSupabaseAdminClient();
  if (!client) {
    throw new Error("Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return client;
}

// Daily earn/ad limits reset at the user's local midnight, not UTC (#211).
function todayLocalDate(): string {
  return todayLocal();
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

  const today = todayLocalDate();
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

// ─── Streak Freeze (LP store item, #237) ─────────────────────────────────────

export interface StreakFreezePurchase {
  allowed: boolean;
  errorCode: "insufficient_lp" | "max_owned" | null;
  newBalance: number;
  freezes: number;
  cost: number;
}

/**
 * Buys one streak freeze for LP. Balance guard, ownership cap, counter
 * increment and the `streak_freeze` ledger insert run atomically inside
 * purchase_streak_freeze — same pattern as spend_lp, so concurrent taps
 * cannot double-charge. Price and cap are server-side constants
 * (featureGates.STREAK_FREEZE); the client sends no numbers.
 */
export async function purchaseStreakFreeze(userId: string): Promise<StreakFreezePurchase> {
  const db = getDb();
  const { data, error } = await db.rpc("purchase_streak_freeze", {
    p_user: userId,
    p_cost: STREAK_FREEZE.costLp,
    p_max: STREAK_FREEZE.maxOwned,
  });

  if (error) throw new Error(`purchaseStreakFreeze: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: row?.allowed ?? false,
    errorCode: (row?.error_code as "insufficient_lp" | "max_owned" | undefined) ?? null,
    newBalance: row?.new_balance ?? 0,
    freezes: row?.freezes ?? 0,
    cost: STREAK_FREEZE.costLp,
  };
}

// ─── Streak Repair (LP, reactive counterpart to the freeze, #237) ────────────

export interface StreakRepairPurchase {
  allowed: boolean;
  errorCode: "no_repair" | "insufficient_lp" | null;
  newBalance: number;
  newStreak: number;
  cost: number;
}

/**
 * Restores a lost streak for LP, within the repair window. All guards (a real
 * loss exists, window not passed, balance suffices) and the streak restore +
 * ledger insert run atomically inside purchase_streak_repair. The local day is
 * computed server-side (Europe/Berlin) so the window can't be gamed by a client
 * clock; price is the server constant.
 */
export async function purchaseStreakRepair(userId: string): Promise<StreakRepairPurchase> {
  const db = getDb();
  const { data, error } = await db.rpc("purchase_streak_repair", {
    p_user: userId,
    p_cost: STREAK_REPAIR.costLp,
    p_today: todayLocalDate(),
  });

  if (error) throw new Error(`purchaseStreakRepair: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: row?.allowed ?? false,
    errorCode: (row?.error_code as "no_repair" | "insufficient_lp" | undefined) ?? null,
    newBalance: row?.new_balance ?? 0,
    newStreak: row?.new_streak ?? 0,
    cost: STREAK_REPAIR.costLp,
  };
}

// ─── Earn ─────────────────────────────────────────────────────────────────────

// The client can never assert a value-creating event — earning is derived from
// activity the server itself recorded:
//   - "session": grant comes from review_logs (earn_session_lp), never a client count.
//   - "dailyGoal": removed — no legitimate client ever sent it.
//   - "ad": the JWT self-grant is retired. A client "I watched an ad" claim is not
//     trustworthy (it minted 5 LP with no ad). Rewarded-ad LP will be granted only via
//     AdMob Server-Side Verification (Google → our server, signature-checked), so this
//     endpoint no longer accepts type:"ad". Tracked in #149.
export type EarnType = "session";

export interface EarnResult {
  granted: number;
  newBalance: number;
  capReached: boolean;
}

// Reviewed cards per rewardable chunk. 1 means: every card pays immediately.
// Was 5, which made 3 reviewed cards worth 0 LP and pushed the remainder into
// an open balance — hard to explain and easy to mistake for a bug.
const CARDS_PER_SESSION_CHUNK = 1;

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
  tier: SubscriptionTier
): Promise<EarnResult> {
  const limits = getLimitsForTier(tier);

  // The SQL counts the user's real, not-yet-rewarded reviews and pays only for
  // whole chunks up to the daily cap, all atomically. The client's claimed card
  // count is intentionally ignored.
  const { data, error } = await getDb().rpc("earn_session_lp", {
    p_user: userId,
    p_lp_per_chunk: LP_EARN_RULES.perReviewSession,
    p_cards_per_chunk: CARDS_PER_SESSION_CHUNK,
    p_earn_cap: limits.lpEarnCapPerDay,
    p_today: todayLocalDate(),
  });
  if (error) throw new Error(`earnLp(session): ${error.message}`);
  return mapEarnRow(data);
}

// ─── Monthly Grant (#604) ────────────────────────────────────────────────────
// Two callers that must never double-credit: the RevenueCat webhook (instant
// credit on purchase/renewal) and the monthly cron /api/v1/lp/monthly-grant
// (annual subs get a RENEWAL only once a YEAR and lifetime never, so without
// the cron they miss most or all of the promised 300 LP/month). Both key the
// grant to the calendar month; grant_monthly_lp inserts the (user, period)
// guard row and credits in one transaction, so whichever caller comes second
// in a month is a no-op regardless of ordering or webhook retries.

export function currentLpGrantPeriod(now = new Date()): string {
  return now.toISOString().slice(0, 7); // calendar month, e.g. "2026-08"
}

export async function grantMonthlyLp(
  userId: string,
  tier: SubscriptionTier,
  period: string
): Promise<boolean> {
  const grant = getLimitsForTier(tier).lpGrantPerMonth;
  if (grant <= 0) return false;

  const db = getDb();
  const { data, error } = await db.rpc("grant_monthly_lp", {
    p_user: userId,
    p_tier: tier,
    p_amount: grant,
    p_period: period,
  });

  if (error) throw new Error(`grantMonthlyLp: ${error.message}`);

  return data === true;
}

// Credits the month's allotment to every profile whose subscription is still
// active (pro/lifetime with no expiry or a future one — same activity rule as
// getSubscriptionTier). A failing grant for one profile must not starve the
// rest of the sweep, so per-user errors are logged and counted, not thrown.
export async function grantMonthlyLpToActiveSubscribers(
  period: string,
  now = new Date()
): Promise<{ eligible: number; granted: number; failed: number }> {
  const db = getDb();
  const { data, error } = await db
    .from("profiles")
    .select("id, subscription_tier, subscription_expires_at")
    .in("subscription_tier", ["pro", "lifetime"]);

  if (error) throw new Error(`grantMonthlyLpToActiveSubscribers: ${error.message}`);

  const rows = (data ?? []) as Array<{
    id: string;
    subscription_tier: SubscriptionTier;
    subscription_expires_at: string | null;
  }>;
  const active = rows.filter(
    (row) => !row.subscription_expires_at || new Date(row.subscription_expires_at) > now
  );

  let granted = 0;
  let failed = 0;
  for (const row of active) {
    try {
      if (await grantMonthlyLp(row.id, row.subscription_tier, period)) granted++;
    } catch (grantError) {
      failed++;
      console.error(`[lp/monthly-grant] grant failed for ${row.id}:`, grantError);
    }
  }
  return { eligible: active.length, granted, failed };
}

// ─── Milestone Reward (idempotent) ───────────────────────────────────────────

export type { MilestoneKey };

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

// ─── Meilensteine automatisch einlösen (#637) ────────────────────────────────
//
// Bis hierher konnte der Server Meilensteine NUR auf Zuruf auszahlen, und im
// Web rief das niemand — die auf der Lernpunkte-Seite beworbenen Boni kamen
// dort also nie an, `first_deck` auf keiner Plattform. Statt jedem Client
// beizubringen, an welchem Bildschirm er nachfragen muss (fünf Lernmodi, vier
// Wege zu einem neuen Deck, zwei Clients), löst der Server sie jetzt selbst
// ein — an den wenigen Stellen, an denen sie nachweislich entstehen.
//
// `claim_milestone_lp` ist je Meilenstein idempotent (#152): der zweite Aufruf
// zahlt nichts und meldet `alreadyClaimed`. Ein doppelter Aufruf ist damit
// harmlos, was diese Automatik überhaupt erst gefahrlos macht.

/**
 * Löst einen Meilenstein ein und meldet ihn nur, wenn dabei WIRKLICH etwas
 * geflossen ist — ein längst eingelöster Bonus liefert `null` und darf keinen
 * Hinweis auslösen.
 *
 * Wirft nie: ein Bonus ist eine Zugabe, keine Bedingung. Wer sein erstes Deck
 * anlegt, soll das Deck bekommen, auch wenn die Gutschrift gerade klemmt — der
 * nächste Auslöser holt sie nach, weil die Sperre erst mit der Gutschrift
 * zusammen gesetzt wird (eine Transaktion, siehe claim_milestone_lp).
 */
export async function awardMilestone(
  userId: string,
  milestone: MilestoneKey
): Promise<MilestoneAward | null> {
  try {
    const result = await claimMilestoneReward(userId, milestone);
    if (result.alreadyClaimed || result.granted <= 0) return null;
    return { key: milestone, lpGranted: result.granted };
  } catch (error) {
    logError("milestone_award_failed", {
      userId,
      milestone,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** „Erstes Deck erstellt" — für jeden Weg, auf dem ein Deck entsteht. */
export async function awardFirstDeckMilestone(userId: string): Promise<MilestoneAward[]> {
  const award = await awardMilestone(userId, "first_deck");
  return award ? [award] : [];
}

const STREAK_MILESTONES: Array<{ streak: number; key: MilestoneKey }> = [
  { streak: 7, key: "streak_7" },
  { streak: 30, key: "streak_30" },
  { streak: 100, key: "streak_100" },
];

/**
 * Meilensteine am ENDE einer Lernsitzung: „erste Lernsitzung" und die
 * Streak-Stufen 7/30/100.
 *
 * Aufgerufen wird das an den Sitzungs-Enden — beim Verrechnen der Lernpunkte
 * (alle Lernmodi) und beim Abgeben einer Prüfung (die keine Punkte gibt und
 * deshalb den anderen Weg nicht nimmt). Bewusst NICHT bei jeder einzelnen
 * Wiederholung: das ist der heißeste Pfad der App, und ein einmaliger Bonus
 * rechtfertigt dort keine zusätzliche Datenbank-Runde je Karte.
 *
 * Der Streak-Stand wird gelesen, nicht vom Client geglaubt. Verglichen wird mit
 * ERREICHT oder ÜBERSCHRITTEN (>=), nicht auf exakte Gleichheit: wer die
 * Abrechnung genau an Tag 30 verpasst (App zu, kein Netz), hätte mit `===` die
 * 100 LP für immer verloren, weil der Streak danach weiterzählt und nie wieder
 * exakt 30 ist. `>=` holt den Bonus beim nächsten Sitzungsende nach — risikolos,
 * weil claim_milestone_lp über den Unique-Index auf (user_id, reward_key) je
 * Meilenstein ohnehin nur einmal auszahlt (#702).
 *
 * „Erste Lernsitzung" ebenso: erst NACH einem Blick in `review_logs` vergeben,
 * nicht mehr bedingungslos bei jedem Aufruf dieser Funktion (#696). Ohne die
 * Prüfung reichte ein blanker POST /lp/earn (oder eine Prüfungsabgabe ohne
 * jemals gesendeten Review) aus, um den Bonus auf einem Konto ganz ohne Karte
 * zu bekommen. Schlägt die Prüfung fehl, bleibt der Bonus diesmal aus statt
 * ungeprüft zu fließen — der nächste echte Sitzungs-Abschluss holt ihn nach.
 */
export async function awardSessionMilestones(userId: string): Promise<MilestoneAward[]> {
  const awards: MilestoneAward[] = [];

  let hasReviewed = false;
  try {
    hasReviewed = await hasAnyReviewLog(userId);
  } catch (error) {
    logError("milestone_review_lookup_failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  if (hasReviewed) {
    const firstReview = await awardMilestone(userId, "first_review");
    if (firstReview) awards.push(firstReview);
  }

  let currentStreak = 0;
  try {
    ({ currentStreak } = await getStreakInfo(userId));
  } catch (error) {
    logError("milestone_streak_lookup_failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return awards;
  }

  for (const { streak, key } of STREAK_MILESTONES) {
    if (currentStreak < streak) continue;
    const award = await awardMilestone(userId, key);
    if (award) awards.push(award);
  }

  return awards;
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
