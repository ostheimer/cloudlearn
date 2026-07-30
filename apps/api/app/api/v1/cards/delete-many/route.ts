import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { deleteCardsForUser } from "@/services/cardService";

/**
 * Mehrere Karten eines Decks löschen (#614), Body: `{ deckId, cardIds }`.
 *
 * POST und nicht DELETE: Die Liste kann bei einem Pro-Deck 2.000 IDs tragen,
 * und ein DELETE mit Nutzlast ist bei Zwischenspeichern und Proxys nicht
 * verlässlich. Gelöscht wird weich — die Karten landen im Papierkorb.
 */
export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const body = await request.json();
    const deleted = await deleteCardsForUser({ ...body, userId: auth.userId });
    return jsonOk(requestId, { requestId, deleted });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
