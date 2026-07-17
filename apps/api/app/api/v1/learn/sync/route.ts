import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { syncOperations } from "@/services/syncService";

// Der Nachzügler-Stapel aus dem Offline-Modus ist EIN Aufruf mit bis zu 500
// Operationen — die Bremse zählt Aufrufe, nicht Karten. Die App synchronisiert
// alle 30 Sekunden, 10/Minute lassen also reichlich Luft für Wiederholversuche.
// Ein 429 ist hier ungefährlich: der Client legt die Operationen zurück in die
// Warteschlange und versucht es erneut, es geht nichts verloren.
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
