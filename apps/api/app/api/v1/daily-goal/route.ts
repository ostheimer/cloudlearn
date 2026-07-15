import { z } from "zod";
import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { updateDailyGoal } from "@/lib/db";

// The daily learning goal (cards/day). Bounds mirror updateDailyGoal's clamp so
// a malformed client is rejected up front rather than silently corrected.
const updateDailyGoalSchema = z.object({
  dailyGoal: z.number().int().min(1).max(500),
});

export async function PATCH(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const parsed = updateDailyGoalSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError(requestId, "INVALID_REQUEST", parsed.error.message, 400);

    // Identity is server-controlled: the goal is written for the token's user,
    // never a userId smuggled into the body.
    const dailyGoal = await updateDailyGoal(auth.userId, parsed.data.dailyGoal);

    return jsonOk(requestId, { requestId, dailyGoal });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
