import { type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { getAuthUser } from "@/lib/auth";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext, logError, logInfo } from "@/lib/observability";
import { checkRateLimit } from "@/lib/rateLimit";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import { runLpChargedIdempotentRequest } from "@/lib/lpChargedIdempotentRequest";
import { getPdfJob, processPdfImport } from "@/services/pdfImportService";

export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  const auth = await getAuthUser(request);
  if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return jsonError(requestId, "MISSING_JOB_ID", "jobId is required", 400);
  }

  const job = getPdfJob(jobId);
  // Same 404 for "does not exist" and "belongs to someone else" — a foreign
  // caller must not be able to probe whether a job id exists.
  if (!job || job.userId !== auth.userId) {
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

    if (!(await checkRateLimit(`${userId}:${plan}`, rateLimit))) {
      return jsonError(requestId, "RATE_LIMITED", "Rate limit exceeded", 429);
    }

    const idempotencyKey =
      typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined;

    const charged = await runLpChargedIdempotentRequest({
      idempotencyKey,
      userId,
      plan,
      feature: "pdfImport",
      requestId,
      refundReason: "refund_pdfImport_failed",
      process: () => processPdfImport(body, requestId, userId),
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

    logInfo("pdf_import_processed", {
      requestId,
      userId,
      fileName: result.fileName,
      pageCount: result.pageCount,
      extractedCharacters: result.extractedCharacters,
      cards: result.cards.length,
      // #411: differs from `cards` when the deck's plan limit thinned the import
      cardsGenerated: result.generatedCount ?? result.cards.length,
      model: result.model,
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
    logError("pdf_import_failed", { requestId, code: normalized.code, message: normalized.message });
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
