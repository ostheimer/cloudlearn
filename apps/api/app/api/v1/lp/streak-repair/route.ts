import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { purchaseStreakRepair } from "@/services/lpService";

// POST /api/v1/lp/streak-repair — restore a lost streak with LP (#237 follow-up).
// Takes no body: price, window and the restored value are all decided
// server-side. 409 when there is nothing to repair (or the window passed),
// 402 when LP is insufficient.
export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const result = await purchaseStreakRepair(auth.userId);

    if (!result.allowed) {
      if (result.errorCode === "no_repair") {
        return jsonError(requestId, "NO_REPAIR",
          "There is no lost streak to repair, or the repair window has passed.", 409);
      }
      return jsonError(requestId, "INSUFFICIENT_LP",
        `Not enough LP. Need ${result.cost}, have ${result.newBalance}.`, 402);
    }

    return jsonOk(requestId, {
      cost: result.cost,
      newBalance: result.newBalance,
      currentStreak: result.newStreak,
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
