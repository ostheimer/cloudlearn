import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { getAiUsage } from "@/lib/usageLimit";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import { getEnv } from "@/lib/env";

// Returns current AI usage counters plus limits for the authenticated user.
// Used by the mobile app to display usage indicators in the Scan screen.
export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const userId = auth.userId;
    const [usage, subscription] = await Promise.all([
      getAiUsage(userId),
      getSubscriptionStatus(userId),
    ]);

    const env = getEnv();
    const isPaid = subscription.tier !== "free";

    return jsonOk(requestId, {
      requestId,
      tier: subscription.tier,
      aiScansUsed: usage.aiScansUsed,
      aiScansLimit: isPaid ? null : env.FREE_SCAN_LIMIT_PER_MONTH,
      aiScansRemaining: isPaid ? null : Math.max(env.FREE_SCAN_LIMIT_PER_MONTH - usage.aiScansUsed, 0),
      urlImportsUsed: usage.aiUrlImportsUsed,
      urlImportsLimit: isPaid ? null : env.FREE_URL_IMPORT_LIMIT_PER_MONTH,
      urlImportsRemaining: isPaid ? null : Math.max(env.FREE_URL_IMPORT_LIMIT_PER_MONTH - usage.aiUrlImportsUsed, 0),
      periodStart: usage.usagePeriodStart,
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
