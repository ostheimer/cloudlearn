import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { API_RATE_LIMITS, enforceUserRateLimit } from "@/lib/apiRateLimit";
import {
  emptyTrashForUser,
  getTrashForUser,
  purgeCardForUser,
  purgeDeckForUser,
} from "@/services/trashService";

/** Inhalt des Papierkorbs: gelöschte Decks und einzeln gelöschte Karten (#614). */
export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);
    await enforceUserRateLimit(auth.userId, "trash", API_RATE_LIMITS.trash);

    const trash = await getTrashForUser(auth.userId);
    return jsonOk(requestId, { requestId, decks: trash.decks, cards: trash.cards });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}

/**
 * Endgültig löschen — ein Deck (`?deckId=`), eine Karte (`?cardId=`) oder alles
 * (`?all=1`). Danach gibt es kein Zurück mehr, deshalb fragt der Client vorher.
 *
 * Ein DELETE ohne jeden Parameter leert NICHT: „alles weg" muss ausdrücklich
 * dastehen, sonst räumt ein verschluckter Query-String den Papierkorb leer.
 */
export async function DELETE(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);
    await enforceUserRateLimit(auth.userId, "trash", API_RATE_LIMITS.trash);

    const params = new URL(request.url).searchParams;
    const deckId = params.get("deckId");
    const cardId = params.get("cardId");
    const all = params.get("all") === "1";

    if (deckId) {
      const ok = await purgeDeckForUser(auth.userId, deckId);
      if (!ok) return jsonError(requestId, "DECK_NOT_FOUND", "Deck not in trash", 404);
      return jsonOk(requestId, { requestId, purged: { decks: 1, cards: 0 } });
    }

    if (cardId) {
      const ok = await purgeCardForUser(auth.userId, cardId);
      if (!ok) return jsonError(requestId, "CARD_NOT_FOUND", "Card not in trash", 404);
      return jsonOk(requestId, { requestId, purged: { decks: 0, cards: 1 } });
    }

    if (all) {
      const purged = await emptyTrashForUser(auth.userId);
      return jsonOk(requestId, { requestId, purged });
    }

    return jsonError(
      requestId,
      "VALIDATION_ERROR",
      "Bitte deckId, cardId oder all=1 angeben",
      400
    );
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
