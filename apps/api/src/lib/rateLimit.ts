import { createSupabaseAdminClient } from "./supabase";

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
  windowSeconds = 60
): Promise<boolean> {
  const db = createSupabaseAdminClient();
  if (!db) return true;

  const { data, error } = await db.rpc("check_rate_limit", {
    p_key: key,
    p_limit: limitPerMinute,
    p_window_seconds: windowSeconds,
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
