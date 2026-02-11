import { type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext, logError, logInfo } from "@/lib/observability";
import { checkRateLimit } from "@/lib/rateLimit";
import { consumeScanQuota } from "@/lib/usageLimit";
import { getAuthUser } from "@/lib/auth";
import { processScan } from "@/services/scanService";
import { getSubscriptionStatus } from "@/services/subscriptionService";

export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const body = await request.json();
    // Inject authenticated userId (override client-provided value)
    body.userId = auth.userId;
    const userId = auth.userId;
    const userSubscription = await getSubscriptionStatus(userId);
    const plan = userSubscription.tier;
    const env = getEnv();
    const limit =
      plan === "pro"
        ? env.RATE_LIMIT_PRO_PER_MINUTE
        : env.RATE_LIMIT_FREE_PER_MINUTE;
    const allowed = checkRateLimit(`${userId}:${plan}`, limit);
    if (!allowed) {
      return jsonError(requestId, "RATE_LIMITED", "Rate limit exceeded", 429);
    }
    const quota = consumeScanQuota(
      userId,
      plan,
      env.FREE_SCAN_LIMIT_PER_MONTH
    );
    if (!quota.allowed) {
      return jsonError(
        requestId,
        "PAYWALL_REQUIRED",
        "Free scan quota exceeded",
        402
      );
    }

    const result = await processScan(body, requestId, userId);
    logInfo("scan_processed", {
      requestId,
      userId,
      cards: result.cards.length,
      model: result.model,
      hasImage: Boolean(body.imageBase64),
      freeScansRemaining: Number.isFinite(quota.remaining)
        ? quota.remaining
        : null,
    });
    return jsonOk(requestId, result);
  } catch (error) {
    const normalized = normalizeError(error);
    logError("scan_failed", {
      requestId,
      code: normalized.code,
      message: normalized.message,
    });
    return jsonError(
      requestId,
      normalized.code,
      normalized.message,
      normalized.status
    );
  }
}
