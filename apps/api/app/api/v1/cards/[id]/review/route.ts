import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { REVIEW_RATE_LIMIT_PER_MINUTE } from "@/lib/reviewLimits";
import { storeReview } from "@/services/reviewService";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    if (!(await checkRateLimit(`review:${auth.userId}`, REVIEW_RATE_LIMIT_PER_MINUTE))) {
      return jsonError(requestId, "RATE_LIMITED", "Rate limit exceeded", 429);
    }

    const body = await request.json();
    const { id } = await params;
    const result = await storeReview(
      { ...body, cardId: id, userId: auth.userId },
      requestId
    );
    return jsonOk(requestId, result, 201);
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
