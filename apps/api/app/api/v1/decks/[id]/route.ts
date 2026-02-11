import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { deleteDeckForUser, updateDeckForUser } from "@/services/deckService";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const body = await request.json();
    const { id } = await params;
    const deck = updateDeckForUser({ ...body, deckId: id });
    if (!deck) {
      return jsonError(requestId, "DECK_NOT_FOUND", "Deck not found", 404);
    }

    return jsonOk(requestId, { requestId, deck });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  const { id } = await params;
  const ok = deleteDeckForUser(id);
  if (!ok) {
    return jsonError(requestId, "DECK_NOT_FOUND", "Deck not found", 404);
  }

  return jsonOk(requestId, { requestId, deleted: true });
}
