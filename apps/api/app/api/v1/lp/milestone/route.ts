import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { claimMilestoneReward } from "@/services/lpService";
import { z } from "zod";

const bodySchema = z.object({
  milestone: z.enum(["first_deck", "first_review", "streak_7", "streak_30", "streak_100"]),
});

// POST /api/v1/lp/milestone — claim a one-time milestone reward (idempotent).
export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(requestId, "VALIDATION_ERROR", parsed.error.message, 400);
    }

    const result = await claimMilestoneReward(auth.userId, parsed.data.milestone);
    return jsonOk(requestId, result);
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
