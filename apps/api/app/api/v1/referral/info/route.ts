import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const db = createSupabaseAdminClient();
    if (!db) return jsonError(requestId, "DB_UNAVAILABLE", "Database not configured", 503);

    // Fetch referral code
    const { data: profile } = await db
      .from("profiles")
      .select("referral_code")
      .eq("id", auth.userId)
      .maybeSingle();

    const referralCode = profile?.referral_code ?? null;

    // Count referred users
    const { count: referredCount } = await db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", auth.userId);

    // Sum LP earned from referrals
    const { data: referralTxs } = await db
      .from("lp_transactions")
      .select("amount")
      .eq("user_id", auth.userId)
      .eq("type", "referral")
      .like("reason", "referral_sent_to_%");

    const lpEarnedFromReferrals = (referralTxs ?? []).reduce(
      (sum, tx) => sum + (tx.amount ?? 0),
      0
    );

    return jsonOk(requestId, {
      referralCode,
      referredCount: referredCount ?? 0,
      lpEarnedFromReferrals,
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
