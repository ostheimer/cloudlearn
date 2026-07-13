import { createSupabaseAdminClient } from "@/lib/supabase";
import { getLimitsForTier } from "@/lib/featureGates";
import { todayLocal } from "@/lib/localDay";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import { verifyAdSsvSignature } from "@/lib/adSsvCrypto";

// AdMob Server-Side Verification (SSV) for rewarded ads.
//
// Google calls GET /api/v1/ads/ssv when a rewarded ad completes. The callback is
// authenticated by Google's ECDSA signature (SHA-256, DER) over the query string,
// NOT by a JWT — so a client can no longer mint ad LP by faking the request.
//
// Verification (per https://developers.google.com/admob/android/ssv):
//   1. The last two query params are always `signature` then `key_id`. Everything
//      before `&signature=` is the signed content.
//   2. Fetch Google's public keys, pick the one matching `key_id`.
//   3. Verify the signature against that public key.
// Only then do we book LP (idempotent per transaction, under the daily ad cap).

const VERIFIER_KEYS_URL = "https://gstatic.com/admob/reward/verifier-keys.json";
const KEYS_TTL_MS = 24 * 60 * 60 * 1000; // keys rotate slowly; refresh daily

let keysCache: { keys: Map<string, string>; fetchedAt: number } | null = null;

async function fetchVerifierKeys(): Promise<Map<string, string>> {
  const res = await fetch(VERIFIER_KEYS_URL);
  if (!res.ok) throw new Error(`AdMob verifier keys fetch failed: ${res.status}`);
  const json = (await res.json()) as { keys?: Array<{ keyId: number; pem: string }> };
  const map = new Map<string, string>();
  for (const k of json.keys ?? []) map.set(String(k.keyId), k.pem);
  return map;
}

// Returns the PEM public key for a key id, refreshing the cache when it is stale
// or when an unseen key id shows up (Google rotates keys).
async function getVerifierKey(keyId: string, now: number): Promise<string | null> {
  const fresh = keysCache !== null && now - keysCache.fetchedAt < KEYS_TTL_MS;
  if (fresh && keysCache!.keys.has(keyId)) return keysCache!.keys.get(keyId)!;
  keysCache = { keys: await fetchVerifierKeys(), fetchedAt: now };
  return keysCache.keys.get(keyId) ?? null;
}

// LP granted per verified rewarded ad.
const LP_PER_VERIFIED_AD = 5;

// Reward policy: a fixed amount in our code. By the time this runs Google has
// signed the callback and we've verified it, so AdMob's console-configured
// rewardAmount/rewardItem are trustworthy — but we deliberately IGNORE them and pay
// a fixed amount, so the LP payout (real-money currency) lives in git and can't be
// changed by editing the AdMob console. The daily ad cap is still enforced
// afterwards by grant_ad_ssv_lp.
export function resolveAdLpGrant(input: { rewardAmount: number; rewardItem: string }): number {
  void input; // console amount/item intentionally not trusted for payout
  return LP_PER_VERIFIED_AD;
}

async function grantAdSsvLp(
  userId: string,
  amount: number,
  adCap: number,
  transactionId: string
): Promise<{ granted: number; alreadyProcessed: boolean }> {
  const db = createSupabaseAdminClient();
  if (!db) throw new Error("Supabase not configured");

  // The daily ad cap resets at the user's local midnight, not UTC (#211).
  const today = todayLocal();
  const { data, error } = await db.rpc("grant_ad_ssv_lp", {
    p_user: userId,
    p_amount: amount,
    p_ad_cap: adCap,
    p_transaction_id: transactionId,
    p_today: today,
  });
  if (error) throw new Error(`grantAdSsvLp: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  return {
    granted: (row?.granted as number | undefined) ?? 0,
    alreadyProcessed: (row?.already_processed as boolean | undefined) ?? false,
  };
}

export type AdSsvOutcome =
  | { status: "granted"; granted: number }
  | { status: "already_processed" }
  | { status: "invalid_signature" }
  | { status: "bad_request" };

// Verifies a raw SSV callback query string and books the reward.
// `rawQuery` must be the query string exactly as received (no re-encoding), so the
// signed bytes match — the route passes request.url's query verbatim.
export async function processAdSsvCallback(rawQuery: string): Promise<AdSsvOutcome> {
  const params = new URLSearchParams(rawQuery);
  const signature = params.get("signature");
  const keyId = params.get("key_id");
  if (!signature || !keyId) return { status: "invalid_signature" };

  // Signed content = everything before the trailing `&signature=` (last two
  // params are always signature then key_id).
  const sigIndex = rawQuery.indexOf("&signature=");
  if (sigIndex < 0) return { status: "invalid_signature" };
  const content = rawQuery.slice(0, sigIndex);

  const pem = await getVerifierKey(keyId, Date.now());
  if (!pem || !verifyAdSsvSignature(content, signature, pem)) {
    return { status: "invalid_signature" };
  }

  // Signature is valid → the values are trustworthy.
  const userId = params.get("user_id"); // the app sets this to the Supabase user id
  const transactionId = params.get("transaction_id");
  const rewardAmount = Number(params.get("reward_amount"));
  const rewardItem = params.get("reward_item") ?? "";
  if (!userId || !transactionId || !Number.isFinite(rewardAmount)) {
    return { status: "bad_request" };
  }

  const amount = resolveAdLpGrant({ rewardAmount, rewardItem });
  const tier = (await getSubscriptionStatus(userId)).tier;
  const adCap = getLimitsForTier(tier).lpAdCapPerDay;

  const { granted, alreadyProcessed } = await grantAdSsvLp(userId, amount, adCap, transactionId);
  return alreadyProcessed ? { status: "already_processed" } : { status: "granted", granted };
}
