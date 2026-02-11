import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { listBetaFeedback, submitBetaFeedback } from "@/services/betaFeedbackService";

export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  const userId = request.nextUrl.searchParams.get("userId") ?? undefined;
  const feedback = listBetaFeedback(userId);
  return jsonOk(requestId, { requestId, feedback });
}

export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const body = await request.json();
    const feedback = submitBetaFeedback(body);
    return jsonOk(requestId, { requestId, feedback }, 201);
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
