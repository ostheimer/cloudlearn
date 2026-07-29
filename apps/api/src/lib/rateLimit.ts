import { createSupabaseAdminClient } from "./supabase";
import type { SubscriptionTier } from "./contracts";

/**
 * Requests-per-minute für einen Tarif. Jeder BEZAHLTE Tarif (pro UND lifetime)
 * bekommt das Pro-Limit — die Import-/Scan-Routen prüften vorher wörtlich
 * `plan === "pro"`, wodurch Lifetime-Käufer auf das Free-Limit fielen (#607).
 */
export function rateLimitPerMinuteForTier(
  tier: SubscriptionTier,
  env: { RATE_LIMIT_FREE_PER_MINUTE: number; RATE_LIMIT_PRO_PER_MINUTE: number }
): number {
  return tier === "free" ? env.RATE_LIMIT_FREE_PER_MINUTE : env.RATE_LIMIT_PRO_PER_MINUTE;
}

/**
 * Persistent, cross-instance rate limiting backed by Supabase Postgres.
 *
 * The check-and-increment happens inside a single `check_rate_limit` SQL
 * statement (INSERT ... ON CONFLICT ... RETURNING), so it survives serverless
 * cold starts, is shared across instances, and has no read-modify-write race.
 *
 * Fails OPEN: if the DB client is missing or the RPC errors we return `true`
 * so a transient DB hiccup never locks out real users.
 */
export async function checkRateLimit(
  key: string,
  limitPerMinute: number,
  windowSeconds = 60,
  /**
   * Gewicht dieser Anfrage. Standard 1 = ein Aufruf zählt einmal.
   *
   * Nötig, weil ein Aufruf mehr als eine Handlung tragen kann: /learn/sync
   * schiebt bis zu 500 Wiederholungen in EINEM Request und würde als ein
   * einziger Zugriff zählen — die Bremse auf dem Einzelweg wäre damit
   * umgehbar. Der Sync zieht deshalb sein Gewicht in Höhe der enthaltenen
   * Wiederholungen aus demselben Topf.
   */
  cost = 1
): Promise<boolean> {
  const db = createSupabaseAdminClient();
  if (!db) return true;

  const { data, error } = await db.rpc("check_rate_limit", {
    p_key: key,
    p_limit: limitPerMinute,
    p_window_seconds: windowSeconds,
    p_cost: cost,
  });

  if (error) {
    console.error("[rateLimit] check_rate_limit error:", error.message);
    return true;
  }

  return data === true;
}

/**
 * No-op retained for backwards compatibility. Rate-limit state now lives in
 * Postgres (`rate_limits` table), so there is no in-process store to clear.
 */
export function resetRateLimitStore(): void {
  // intentionally empty
}
