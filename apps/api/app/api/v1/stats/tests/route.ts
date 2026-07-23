import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { getLastTestAttempts } from "@/lib/db";

/**
 * GET /api/v1/stats/tests — die letzten fünf abgegebenen Prüfungen dieser
 * Nutzerin, neueste zuerst, je mit Deck-Titel, Datum und „x von y".
 *
 * Prüfungen zu gelöschten Decks fehlen bewusst (Laras Regel „Deck gelöscht ->
 * Prüfungen weg"). Kein Pro-Gate: die getrennte Prüfungs-Sicht ist eine
 * Reparatur der Statistik, keine Zusatzfunktion.
 */
export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const attempts = await getLastTestAttempts(auth.userId, 5);
    return jsonOk(requestId, { requestId, attempts });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
