import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { deleteCardForUser, updateCardForUser } from "@/services/cardService";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const body = await request.json();
    const { id } = await params;
    const card = updateCardForUser({ ...body, cardId: id });
    if (!card) {
      return jsonError(requestId, "CARD_NOT_FOUND", "Card not found", 404);
    }

    return jsonOk(requestId, { requestId, card });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  const { id } = await params;
  const ok = deleteCardForUser(id);
  if (!ok) {
    return jsonError(requestId, "CARD_NOT_FOUND", "Card not found", 404);
  }

  return jsonOk(requestId, { requestId, deleted: true });
}
