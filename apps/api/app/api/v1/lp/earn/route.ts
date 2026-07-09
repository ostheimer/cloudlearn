import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { earnLp } from "@/services/lpService";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import { lpEarnRequestSchema } from "@/lib/contracts";

// POST /api/v1/lp/earn — grant LP for a completed learning session (type:"session").
// Rewarded-ad LP is NOT granted here anymore; it requires AdMob Server-Side
// Verification via its own endpoint (#149). "dailyGoal"/"ad" are rejected by the schema.
export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const body = await request.json().catch(() => ({}));
    const parsed = lpEarnRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(requestId, "VALIDATION_ERROR", parsed.error.message, 400);
    }

    const subscription = await getSubscriptionStatus(auth.userId);
    // The grant is derived server-side from recorded reviews; parsed.data.sessionCardCount
    // is accepted for client compatibility but ignored. (parsed.data.type is always
    // "session" — the schema rejects anything else.)
    const result = await earnLp(auth.userId, subscription.tier);

    return jsonOk(requestId, {
      granted: result.granted,
      newBalance: result.newBalance,
      capReached: result.capReached,
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
