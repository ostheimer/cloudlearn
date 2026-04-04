import { type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { getAuthUser } from "@/lib/auth";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext, logError, logInfo } from "@/lib/observability";
import { checkRateLimit } from "@/lib/rateLimit";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import { spendLp } from "@/services/lpService";
import { getPdfJob, processPdfImport } from "@/services/pdfImportService";

export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return jsonError(requestId, "MISSING_JOB_ID", "jobId is required", 400);
  }

  const job = getPdfJob(jobId);
  if (!job) {
    return jsonError(requestId, "JOB_NOT_FOUND", "PDF import job not found", 404);
  }

  return jsonOk(requestId, { requestId, job });
}

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

    const lpResult = await spendLp(userId, plan, "pdfImport");
    if (!lpResult.allowed) {
      return jsonError(
        requestId,
        "INSUFFICIENT_LP",
        `Not enough LP. Need ${lpResult.cost}, have ${lpResult.newBalance}.`,
        402
      );
    }

    const result = await processPdfImport(body, requestId, userId);
    logInfo("pdf_import_processed", {
      requestId,
      userId,
      fileName: result.fileName,
      pageCount: result.pageCount,
      extractedCharacters: result.extractedCharacters,
      cards: result.cards.length,
      model: result.model,
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
    logError("pdf_import_failed", { requestId, code: normalized.code, message: normalized.message });
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
