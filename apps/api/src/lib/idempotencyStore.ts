import { HttpError } from "./http";
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

// AI generation needs admission BEFORE processing, not only a finished cache.
// No memory fallback or time-based takeover: an interrupted process may still
// have an in-flight provider request. Operators reconcile stuck claims first.
export async function claimAiRequest<T>(key: string, owner: string, fingerprint = key): Promise<{ status: "claimed" | "in_progress" } | { status: "complete"; response: T }> {
  const data = await aiClaimRpc("claim_ai_request", { p_key: key, p_owner: owner, p_fingerprint: fingerprint });
  if (data?.status === "complete" && data.response != null) return data;
  if (data?.status === "claimed" || data?.status === "in_progress") return data;
  throw claimUnavailable();
}
export async function completeAiRequest(key: string, owner: string, response: unknown): Promise<void> {
  if (await aiClaimRpc("complete_ai_request", { p_key: key, p_owner: owner, p_response: response }) !== true) throw claimUnavailable();
}
export async function releaseAiRequest(key: string, owner: string): Promise<void> {
  if (await aiClaimRpc("release_ai_request", { p_key: key, p_owner: owner }) !== true) throw claimUnavailable();
}
async function aiClaimRpc(name: string, args: Record<string, unknown>) {
  const db = createSupabaseAdminClient();
  if (!db) throw claimUnavailable();
  let result;
  try { result = await db.rpc(name, args); } catch { throw claimUnavailable(); }
  if (result.error || result.data == null) throw claimUnavailable();
  return result.data;
}
function claimUnavailable(): HttpError {
  return new HttpError("Die KI-Anfrageprüfung ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.", 503, "AI_REQUEST_UNAVAILABLE");
}
