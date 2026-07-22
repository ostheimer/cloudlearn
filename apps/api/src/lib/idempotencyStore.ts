import { createSupabaseAdminClient } from "./supabase";

/**
 * Persistent idempotency store backed by Supabase Postgres (`idempotency_keys`).
 *
 * Survives serverless cold starts and is shared across instances, so a retried
 * request that landed on a different instance still returns the original result.
 * Writes are first-write-wins (upsert with ignoreDuplicates).
 */
export async function getIdempotentResult<T>(key: string): Promise<T | null> {
  const db = createSupabaseAdminClient();
  if (!db) return null;

  const { data, error } = await db
    .from("idempotency_keys")
    .select("response")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) return null;
  return data.response as T;
}

export async function storeIdempotentResult(key: string, value: unknown): Promise<void> {
  const db = createSupabaseAdminClient();
  if (!db) return;

  await db
    .from("idempotency_keys")
    .upsert({ key, response: value }, { onConflict: "key", ignoreDuplicates: true });
}

/**
 * Atomically removes and returns a one-shot idempotency value.
 *
 * Used for paid import preview receipts: concurrent save requests can both see
 * the receipt, but only one DELETE ... RETURNING statement can claim it. The
 * loser must wait/retry instead of writing a second deck.
 */
export async function takeIdempotentResult<T>(key: string): Promise<T | null> {
  const db = createSupabaseAdminClient();
  if (!db) return null;

  const { data, error } = await db
    .from("idempotency_keys")
    .delete()
    .eq("key", key)
    .select("response")
    .maybeSingle();

  if (error || !data) return null;
  return data.response as T;
}

/**
 * No-op retained for backwards compatibility. Idempotency state now lives in
 * Postgres (`idempotency_keys` table), so there is no in-process store to clear.
 */
export function resetIdempotencyStore(): void {
  // intentionally empty
}
