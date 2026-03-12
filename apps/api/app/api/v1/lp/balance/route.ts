import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { getLpProfile } from "@/services/lpService";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import { getLimitsForTier } from "@/lib/featureGates";

// GET /api/v1/lp/balance — returns LP balance, daily earn progress and caps.
export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const [profile, subscription] = await Promise.all([
      getLpProfile(auth.userId),
      getSubscriptionStatus(auth.userId),
    ]);

    const limits = getLimitsForTier(subscription.tier);

    return jsonOk(requestId, {
      balance: profile.balance,
      earnedToday: profile.earnedToday,
      adsToday: profile.adsToday,
      earnCapToday: limits.lpEarnCapPerDay,
      adCapToday: limits.lpAdCapPerDay,
      tier: subscription.tier,
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
