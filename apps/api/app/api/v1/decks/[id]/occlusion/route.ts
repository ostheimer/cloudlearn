import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { API_RATE_LIMITS, enforceUserRateLimit } from "@/lib/apiRateLimit";
import { getAuthUser } from "@/lib/auth";
import { editOcclusionImageForUser } from "@/services/occlusionService";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);
    const { id } = await params;
    const body = await request.json();
    const expectedCount = Array.isArray(body?.expectedCards) ? body.expectedCards.length : 1;
    const regionCount = Array.isArray(body?.regions) ? body.regions.length : 0;
    await enforceUserRateLimit(auth.userId, "occlusion-edit", API_RATE_LIMITS.bulkCardOperations, Math.max(1, expectedCount + regionCount));
    const result = await editOcclusionImageForUser({ ...body, deckId: id, userId: auth.userId });
    return jsonOk(requestId, { requestId, ...result });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
