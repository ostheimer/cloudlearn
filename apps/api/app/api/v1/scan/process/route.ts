import { type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext, logError, logInfo } from "@/lib/observability";
import { checkRateLimit } from "@/lib/rateLimit";
import { getAuthUser } from "@/lib/auth";
import { runLpChargedIdempotentRequest } from "@/lib/lpChargedIdempotentRequest";
import { processScan } from "@/services/scanService";
import { getSubscriptionStatus } from "@/services/subscriptionService";

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

    const idempotencyKey =
      typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined;

    const charged = await runLpChargedIdempotentRequest({
      idempotencyKey,
      userId,
      plan,
      feature: "aiScan",
      requestId,
      refundReason: "refund_aiScan_failed",
      process: () => processScan(body, requestId, userId),
    });

    if (charged.kind === "insufficient_lp") {
      return jsonError(
        requestId,
        "INSUFFICIENT_LP",
        `Not enough LP. Have ${charged.usage.lpBalance}.`,
        402
      );
    }

    const { result, usage } = charged;

    logInfo("scan_processed", {
      requestId,
      userId,
      cards: result.cards.length,
      // #411: differs from `cards` when the deck's plan limit thinned the import
      cardsGenerated: result.generatedCount ?? result.cards.length,
      model: result.model,
      hasImage: Boolean(body.imageBase64),
      lpSpent: usage.lpSpent,
      lpBalance: usage.lpBalance,
      idempotentReplay: usage.lpSpent === 0,
    });
    return jsonOk(requestId, {
      ...result,
      usage,
    });
  } catch (error) {
    const normalized = normalizeError(error);
    logError("scan_failed", { requestId, code: normalized.code, message: normalized.message });
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
