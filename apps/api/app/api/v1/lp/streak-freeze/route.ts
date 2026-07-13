import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { purchaseStreakFreeze } from "@/services/lpService";
import { STREAK_FREEZE } from "@/lib/featureGates";

// POST /api/v1/lp/streak-freeze — buy one streak freeze with LP (#237).
// Takes no body: price and ownership cap are server-side constants, so a
// client cannot negotiate either. Consumption happens automatically inside
// update_streak_after_review, never through an endpoint.
export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const result = await purchaseStreakFreeze(auth.userId);

    if (!result.allowed) {
      if (result.errorCode === "max_owned") {
        return jsonError(requestId, "MAX_FREEZES",
          `You already own the maximum of ${STREAK_FREEZE.maxOwned} streak freezes.`, 409);
      }
      return jsonError(requestId, "INSUFFICIENT_LP",
        `Not enough LP. Need ${result.cost}, have ${result.newBalance}.`, 402);
    }

    return jsonOk(requestId, {
      cost: result.cost,
      newBalance: result.newBalance,
      streakFreezes: result.freezes,
      maxFreezes: STREAK_FREEZE.maxOwned,
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
