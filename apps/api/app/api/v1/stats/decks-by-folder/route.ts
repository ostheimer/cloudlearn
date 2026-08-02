import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { API_RATE_LIMITS, enforceUserRateLimit } from "@/lib/apiRateLimit";
import { countDecksByFolderForUser } from "@/services/folderService";

/**
 * GET /api/v1/stats/decks-by-folder — Decks je Ordner, als Zählung (#612).
 *
 * Die Ordner-Kacheln in Bibliothek und Ordnerseite ("3 Decks") holten sich die
 * Zahl bisher mit einer eigenen Anfrage pro Ordner — jede zog die vollen
 * Deck-Datensätze samt Kartenzählern über die Leitung, nur damit der Client
 * `length` davon liest (N+1). Hier kommt alles in einer Antwort, und es fließen
 * nur Ordner-IDs.
 *
 * Ordner ohne Decks fehlen im Ergebnis (Clients lesen fehlend als 0) — dieselbe
 * Absprache wie bei /stats/due-by-deck.
 */
export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);
    await enforceUserRateLimit(auth.userId, "decks-by-folder", API_RATE_LIMITS.folderStats);

    const decksByFolder = await countDecksByFolderForUser(auth.userId);

    return jsonOk(requestId, { requestId, decksByFolder });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
