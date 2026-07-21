import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { getLpProfile } from "@/services/lpService";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import { getLimitsForTier } from "@/lib/featureGates";

// GET /api/v1/usage — returns LP balance + daily earn progress for the authenticated user.
export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const userId = auth.userId;
    const [profile, subscription] = await Promise.all([
      getLpProfile(userId),
      getSubscriptionStatus(userId),
    ]);

    const limits = getLimitsForTier(subscription.tier);

    return jsonOk(requestId, {
      requestId,
      tier: subscription.tier,
      lpBalance: profile.balance,
      lpEarnedToday: profile.earnedToday,
      lpAdsToday: profile.adsToday,
      lpEarnCapToday: limits.lpEarnCapPerDay,
      lpAdCapToday: limits.lpAdCapPerDay,
      lpCostAiScan: limits.lpCostAiScan,
      lpCostUrlImport: limits.lpCostUrlImport,
      lpCostPdfImport: limits.lpCostPdfImport,
      periodStart: profile.lpPeriodStart,
      // #411: the app has to know the plan limits BEFORE it spends Lernpunkte,
      // otherwise it can only find out by starting a scan that then fails.
      limits: {
        maxDecks: limits.maxDecks,
        maxCardsPerDeck: limits.maxCardsPerDeck,
      },
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
