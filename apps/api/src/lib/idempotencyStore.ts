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
 * No-op retained for backwards compatibility. Idempotency state now lives in
 * Postgres (`idempotency_keys` table), so there is no in-process store to clear.
 */
export function resetIdempotencyStore(): void {
  // intentionally empty
}
