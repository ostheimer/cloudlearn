import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { REVIEW_RATE_LIMIT_PER_MINUTE } from "@/lib/reviewLimits";
import { syncOperations } from "@/services/syncService";

// Bremst die Zahl der AUFRUFE. Die App synchronisiert alle 30 Sekunden, 10/min
// lassen also reichlich Luft für Wiederholversuche.
const SYNC_RATE_LIMIT_PER_MINUTE = 10;

export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    if (!(await checkRateLimit(`sync:${auth.userId}`, SYNC_RATE_LIMIT_PER_MINUTE))) {
      return jsonError(requestId, "RATE_LIMITED", "Rate limit exceeded", 429);
    }

    const body = await request.json();

    // Der Sync ruft storeReview direkt auf, läuft also NICHT durch die Bremse
    // der Review-Route. Ein Paket darf 500 Wiederholungen tragen und zählte
    // oben als ein Aufruf — ohne diesen Block wären 10 Pakete/min = 5000
    // Wiederholungen/min statt 600. Deshalb: dasselbe Kontingent, Gewicht in
    // Höhe der enthaltenen Wiederholungen.
    const reviewCount = Array.isArray((body as { operations?: unknown })?.operations)
      ? ((body as { operations: Array<{ operationType?: string }> }).operations ?? []).filter(
          (op) => op?.operationType === "review"
        ).length
      : 0;
    if (
      reviewCount > 0 &&
      !(await checkRateLimit(
        `review:${auth.userId}`,
        REVIEW_RATE_LIMIT_PER_MINUTE,
        60,
        reviewCount
      ))
    ) {
      // Bewusst 429 auf den GANZEN Aufruf statt einzelne Operationen als
      // abgelehnt zu melden: der Client verwirft abgelehnte Operationen
      // endgültig (finalizeOperations). So legt er sie stattdessen zurück in
      // die Warteschlange (restoreInFlight) und versucht es in 30 s erneut.
      return jsonError(requestId, "RATE_LIMITED", "Rate limit exceeded", 429);
    }

    const result = await syncOperations(
      {
        ...body,
        userId: auth.userId,
      },
      requestId
    );
    return jsonOk(requestId, result, 201);
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
