import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { getLastLearnedByDeck } from "@/lib/db";

/**
 * GET /api/v1/stats/last-learned-by-deck — Zeitpunkt der letzten Antwort je Deck
 * (#614, für die Sortierung „zuletzt gelernt" in Bibliothek und App).
 *
 * Im Muster von /stats/due-by-deck: es fließen nur Deck-IDs und Zeitstempel,
 * keine Kartentexte. Decks ohne jede Antwort fehlen im Ergebnis — Clients lesen
 * fehlend als „noch nie gelernt" und sortieren sie ans Ende.
 */
export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const lastLearnedByDeck = await getLastLearnedByDeck(auth.userId);

    return jsonOk(requestId, { requestId, lastLearnedByDeck });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
