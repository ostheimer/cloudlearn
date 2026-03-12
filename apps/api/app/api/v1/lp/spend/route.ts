import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { spendLp } from "@/services/lpService";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import { lpSpendRequestSchema } from "@/lib/contracts";

// POST /api/v1/lp/spend — deduct LP for a paid KI feature.
// The route itself does not execute the feature; callers must check `allowed` before
// proceeding. The actual feature routes (scan, import, ...) call this internally.
export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const body = await request.json().catch(() => ({}));
    const parsed = lpSpendRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(requestId, "VALIDATION_ERROR", parsed.error.message, 400);
    }

    const subscription = await getSubscriptionStatus(auth.userId);
    const result = await spendLp(auth.userId, subscription.tier, parsed.data.feature);

    if (!result.allowed) {
      return jsonError(requestId, "INSUFFICIENT_LP",
        `Not enough LP. Need ${result.cost}, have ${result.newBalance}.`, 402);
    }

    return jsonOk(requestId, {
      cost: result.cost,
      newBalance: result.newBalance,
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
