import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { TEST_ATTEMPT_RATE_LIMIT_PER_MINUTE } from "@/lib/reviewLimits";
import { submitTestAttempt } from "@/services/testAttemptService";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/decks/:id/tests — eine ABGEGEBENE Prüfung protokollieren.
 *
 * Body: { idempotencyKey, answers: [{ cardId, correct }] }. userId und deckId
 * kommen aus Token bzw. Pfad, nie aus dem Body — im Body geschmuggelte Werte
 * werden überschrieben. Der Server zählt selbst (siehe Service); das Ergebnis
 * steht nicht im Body.
 *
 * Eigener Bremstopf (nicht der Review-Topf): diese Route legt keine
 * review_logs-Zeile an und kann die Review-Bremse deshalb nicht aushebeln.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    if (!(await checkRateLimit(`test-attempt:${auth.userId}`, TEST_ATTEMPT_RATE_LIMIT_PER_MINUTE))) {
      return jsonError(requestId, "RATE_LIMITED", "Rate limit exceeded", 429);
    }

    const body = await request.json();
    const { id } = await params;
    const result = await submitTestAttempt(
      { ...body, deckId: id, userId: auth.userId },
      requestId
    );
    return jsonOk(requestId, result, 201);
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
