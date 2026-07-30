import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { listCardsInFolderForUser } from "@/services/folderService";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/folders/[id]/cards — alle Karten der Decks eines Ordners (#612).
 *
 * "Alle Karten lernen" im Ordner lud die Karten bisher Deck für Deck: bei einem
 * Ordner mit 20 Decks 20 Anfragen, von denen der Browser nur wenige gleichzeitig
 * laufen lässt. Serverseitig ist es eine Abfrage über alle Deck-IDs, seitenweise
 * geladen — also ohne die stille 1000-Zeilen-Kappung von PostgREST.
 *
 * 404, wenn der Ordner nicht dem Aufrufer gehört oder nicht existiert.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const { id } = await params;
    const cards = await listCardsInFolderForUser(id, auth.userId);
    if (cards === null) return jsonError(requestId, "NOT_FOUND", "Folder not found", 404);

    return jsonOk(requestId, { requestId, cards });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
