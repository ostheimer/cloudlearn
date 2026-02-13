import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { exportDeckForOffline } from "@/services/deckService";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const { id } = await params;
    const data = await exportDeckForOffline(auth.userId, id);
    return jsonOk(requestId, {
      requestId,
      deck: data.deck,
      cards: data.cards,
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
