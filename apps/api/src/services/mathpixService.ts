import { createSupabaseAdminClient } from "../lib/supabase";

const COST_PER_IMAGE_USD = 0.002;
const DEFAULT_BUDGET_USD = 5;

/**
 * Persistent, per-user Mathpix cost budget backed by Supabase Postgres.
 *
 * Was an in-process `Map`, which was lost on every serverless cold start and
 * not shared across instances — so the LIFETIME per-user cap silently reset.
 * State now lives in the `mathpix_usage` table; the consume is a single atomic
 * SQL statement (INSERT ... ON CONFLICT ... RETURNING), so it is race-safe.
 *
 * Fails OPEN: if the DB client is missing or a query errors we treat spend as 0
 * (→ request allowed), so a transient DB hiccup never blocks real users.
 */

export async function getMathpixSpend(userId: string): Promise<number> {
  const db = createSupabaseAdminClient();
  if (!db) return 0;

  const { data, error } = await db
    .from("mathpix_usage")
    .select("spent_usd")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return 0;
  return Number(data.spent_usd) || 0;
}

export async function canProcessMathpix(
  userId: string,
  budgetUsd = DEFAULT_BUDGET_USD
): Promise<boolean> {
  const spent = await getMathpixSpend(userId);
  return spent + COST_PER_IMAGE_USD <= budgetUsd;
}

export async function consumeMathpixCost(userId: string): Promise<number> {
  const db = createSupabaseAdminClient();
  if (!db) return 0;

  const { data, error } = await db.rpc("consume_mathpix_cost", {
    p_user: userId,
    p_cost: COST_PER_IMAGE_USD,
  });

  if (error) {
    console.error("[mathpix] consume_mathpix_cost error:", error.message);
    return 0;
  }

  return Number(data) || 0;
}

/**
 * No-op retained for backwards compatibility. Mathpix spend now lives in
 * Postgres (`mathpix_usage` table), so there is no in-process store to clear.
 */
export async function resetMathpixCosts(): Promise<void> {
  // intentionally empty
}
