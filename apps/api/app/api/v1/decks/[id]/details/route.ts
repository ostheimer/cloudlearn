import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { getDeckDetails } from "@/services/deckService";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const { id } = await params;
    const details = await getDeckDetails(id);
    if (!details) {
      return jsonError(requestId, "DECK_NOT_FOUND", "Deck not found", 404);
    }
    return jsonOk(requestId, { requestId, details });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
