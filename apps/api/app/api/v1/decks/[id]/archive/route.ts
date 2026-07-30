import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { setDeckArchivedForUser } from "@/services/deckService";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST — Deck archivieren (#614).
 *
 * Es verschwindet aus Bibliothek und Fällig-Stapel, bleibt aber samt Karten und
 * Lernfortschritt erhalten. Gelöscht wird nichts; deshalb zählt es weiter gegen
 * die Deck-Grenze des Tarifs.
 *
 * Eigene Route statt eines Feldes in PATCH /decks/:id: Archivieren ist eine
 * Handlung mit eigener Bedeutung, kein Bearbeiten des Decks — und so kann ein
 * versehentlich mitgeschicktes Feld ein Deck nicht nebenbei verschwinden
 * lassen. Gleiches Muster wie /share (POST setzt, DELETE nimmt zurück).
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const { id } = await params;
    const { deck } = await setDeckArchivedForUser(auth.userId, id, true);
    return jsonOk(requestId, { requestId, deck });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}

/** DELETE — Deck aus dem Archiv zurückholen. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const { id } = await params;
    const { deck } = await setDeckArchivedForUser(auth.userId, id, false);
    return jsonOk(requestId, { requestId, deck });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
