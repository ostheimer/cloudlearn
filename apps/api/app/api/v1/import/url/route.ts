import { type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext, logError, logInfo } from "@/lib/observability";
import { checkRateLimit } from "@/lib/rateLimit";
import { consumeUrlImportQuota } from "@/lib/usageLimit";
import { getAuthUser } from "@/lib/auth";
import { processUrlImport } from "@/services/urlImportService";
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
    if (!checkRateLimit(`${userId}:${plan}`, rateLimit)) {
      return jsonError(requestId, "RATE_LIMITED", "Rate limit exceeded", 429);
    }

    // URL imports have a separate (tighter) monthly quota than AI scans
    const quota = await consumeUrlImportQuota(userId, plan, env.FREE_URL_IMPORT_LIMIT_PER_MONTH);
    if (!quota.allowed) {
      return jsonError(requestId, "PAYWALL_REQUIRED", "Free URL import quota exceeded", 402);
    }

    const result = await processUrlImport(body, requestId, userId);
    logInfo("url_import_processed", {
      requestId,
      userId,
      sourceUrl: result.sourceUrl,
      cards: result.cards.length,
      model: result.model,
      imagesUsed: result.imagesUsed,
      freeUrlImportsRemaining: Number.isFinite(quota.remaining) ? quota.remaining : null,
    });
    return jsonOk(requestId, {
      ...result,
      usage: {
        urlImportsRemaining: Number.isFinite(quota.remaining) ? quota.remaining : null,
        urlImportsLimit: plan === "free" ? env.FREE_URL_IMPORT_LIMIT_PER_MONTH : null,
      },
    });
  } catch (error) {
    const normalized = normalizeError(error);
    logError("url_import_failed", { requestId, code: normalized.code, message: normalized.message });
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
