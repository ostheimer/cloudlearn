import { type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { listBetaFeedback, submitBetaFeedback } from "@/services/betaFeedbackService";

export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  const auth = await getAuthUser(request);
  if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

  // Only the caller's own feedback — a `?userId=` query parameter is ignored so
  // nobody can enumerate other users' feedback.
  const feedback = listBetaFeedback(auth.userId);
  return jsonOk(requestId, { requestId, feedback });
}

export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const body = await request.json();
    // User identity comes exclusively from the verified token — a userId
    // smuggled into the body is overwritten, never trusted.
    const feedback = submitBetaFeedback({ ...body, userId: auth.userId });
    return jsonOk(requestId, { requestId, feedback }, 201);
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
