import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { getDueCardCountsByDeck } from "@/services/learnService";

/**
 * GET /api/v1/stats/due-by-deck — fällige Karten je Deck, als Zählung (#612).
 *
 * Die "N fällig"-Abzeichen in Bibliothek und Ordnern summierten bisher die
 * Antwort von /learn/due — das überträgt den kompletten fälligen Rückstand
 * mit Kartentext, nur um ihn wegzuwerfen, und PostgREST kappt die Liste still
 * bei 1000 Zeilen, ab da lügen die Zahlen. Hier fließen nur Deck-IDs; Decks
 * ohne fällige Karten fehlen im Ergebnis (Clients lesen fehlend als 0).
 */
export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const dueByDeck = await getDueCardCountsByDeck(auth.userId);

    return jsonOk(requestId, { requestId, dueByDeck });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
