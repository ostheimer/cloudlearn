import { z } from "zod";
import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { LP_EARN_RULES } from "@/lib/featureGates";
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

    // Check if claimer already used a referral code
    const { data: claimerProfile } = await db
      .from("profiles")
      .select("referred_by, lp_balance")
      .eq("id", claimerId)
      .maybeSingle();

    if (claimerProfile?.referred_by) {
      return jsonError(requestId, "ALREADY_REFERRED", "You have already used a referral code", 409);
    }

    // Find the referrer by code
    const { data: referrerProfile } = await db
      .from("profiles")
      .select("id, lp_balance")
      .eq("referral_code", code)
      .maybeSingle();

    if (!referrerProfile) {
      return jsonError(requestId, "CODE_NOT_FOUND", "Referral code not found", 404);
    }

    if (referrerProfile.id === claimerId) {
      return jsonError(requestId, "SELF_REFERRAL", "You cannot use your own referral code", 400);
    }

    const referrerBonus = LP_EARN_RULES.referralSender;
    const claimerBonus = LP_EARN_RULES.referralReceiver;

    // Grant LP to referrer
    const referrerNewBalance = (referrerProfile.lp_balance ?? 0) + referrerBonus;
    await db.from("profiles").update({ lp_balance: referrerNewBalance }).eq("id", referrerProfile.id);
    await db.from("lp_transactions").insert({
      user_id: referrerProfile.id,
      type: "referral",
      amount: referrerBonus,
      reason: `referral_sent_to_${claimerId}`,
    });

    // Grant LP to claimer and record referred_by
    const claimerNewBalance = (claimerProfile?.lp_balance ?? 0) + claimerBonus;
    await db.from("profiles").update({
      lp_balance: claimerNewBalance,
      referred_by: referrerProfile.id,
    }).eq("id", claimerId);
    await db.from("lp_transactions").insert({
      user_id: claimerId,
      type: "referral",
      amount: claimerBonus,
      reason: `referral_received_from_${referrerProfile.id}`,
    });

    return jsonOk(requestId, {
      success: true,
      lpGranted: claimerBonus,
      newBalance: claimerNewBalance,
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
