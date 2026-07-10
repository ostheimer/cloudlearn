import { type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext, logError, logInfo } from "@/lib/observability";
import { checkRateLimit } from "@/lib/rateLimit";
import { getAuthUser } from "@/lib/auth";
import { processScan } from "@/services/scanService";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import { spendLp } from "@/services/lpService";
import { refundOnFailure } from "@/lib/lpRefund";

export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const body = await request.json();
    body.userId = auth.userId;
    const userId = auth.userId;

    const userSubscription = await getSubscriptionStatus(userId);
    const plan = userSubscription.tier;
    const env = getEnv();

    const rateLimit = plan === "pro" ? env.RATE_LIMIT_PRO_PER_MINUTE : env.RATE_LIMIT_FREE_PER_MINUTE;
    if (!(await checkRateLimit(`${userId}:${plan}`, rateLimit))) {
      return jsonError(requestId, "RATE_LIMITED", "Rate limit exceeded", 429);
    }

    // Deduct LP for AI scan (cost is tier-dependent)
    const lpResult = await spendLp(userId, plan, "aiScan");
    if (!lpResult.allowed) {
      return jsonError(
        requestId,
        "INSUFFICIENT_LP",
        `Not enough LP. Need ${lpResult.cost}, have ${lpResult.newBalance}.`,
        402
      );
    }

    // LP were charged up front, but processScan can still fail — e.g. an image
    // scan the AI can't turn into cards (no heuristic fallback on the image
    // path). Refund the LP so a failed scan never costs the user anything.
    let result: Awaited<ReturnType<typeof processScan>>;
    try {
      result = await processScan(body, requestId, userId);
    } catch (processingError) {
      await refundOnFailure(userId, lpResult.cost, "refund_aiScan_failed", requestId);
      throw processingError;
    }

    logInfo("scan_processed", {
      requestId,
      userId,
      cards: result.cards.length,
      model: result.model,
      hasImage: Boolean(body.imageBase64),
      lpSpent: lpResult.cost,
      lpBalance: lpResult.newBalance,
    });
    return jsonOk(requestId, {
      ...result,
      usage: {
        lpSpent: lpResult.cost,
        lpBalance: lpResult.newBalance,
      },
    });
  } catch (error) {
    const normalized = normalizeError(error);
    logError("scan_failed", { requestId, code: normalized.code, message: normalized.message });
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
