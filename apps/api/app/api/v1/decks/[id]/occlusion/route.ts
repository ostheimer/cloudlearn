import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { editOcclusionImageForUser } from "@/services/occlusionService";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);
    const { id } = await params;
    const body = await request.json();
    const result = await editOcclusionImageForUser({ ...body, deckId: id, userId: auth.userId });
    return jsonOk(requestId, { requestId, ...result });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
