import { z } from "zod";
import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { LP_EARN_RULES, REFERRAL_SENDER_CAP } from "@/lib/featureGates";
import { createSupabaseAdminClient } from "@/lib/supabase";

const claimReferralSchema = z.object({
  code: z.string().min(4).max(20).toUpperCase(),
});

export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const body = claimReferralSchema.safeParse(await request.json());
    if (!body.success) {
      return jsonError(requestId, "INVALID_CODE", "Invalid referral code format", 400);
    }

    const db = createSupabaseAdminClient();
    if (!db) return jsonError(requestId, "DB_UNAVAILABLE", "Database not configured", 503);

    const { code } = body.data;
    const claimerId = auth.userId;

    // Atomic, idempotent claim with a per-referrer cap (#203). One transaction
    // row-locks the claimer + referrer rows, so it closes the old TOCTOU /
    // lost-update races and makes retries idempotent. Amounts and the claimer
    // identity are server-controlled — never trusted from the client.
    const { data, error } = await db.rpc("claim_referral", {
      p_claimer: claimerId,
      p_code: code,
      p_referrer_bonus: LP_EARN_RULES.referralSender,
      p_claimer_bonus: LP_EARN_RULES.referralReceiver,
      p_referrer_cap: REFERRAL_SENDER_CAP,
    });
    if (error) throw new Error(error.message);

    switch (data.status) {
      case "already_referred":
        return jsonError(requestId, "ALREADY_REFERRED", "You have already used a referral code", 409);
      case "code_not_found":
        return jsonError(requestId, "CODE_NOT_FOUND", "Referral code not found", 404);
      case "self":
        return jsonError(requestId, "SELF_REFERRAL", "You cannot use your own referral code", 400);
      case "claimer_not_found":
        return jsonError(requestId, "PROFILE_NOT_FOUND", "Profile not found", 404);
    }

    return jsonOk(requestId, {
      success: true,
      lpGranted: data.claimerBonus,
      newBalance: data.newBalance,
      referrerCapped: data.referrerCapped,
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
