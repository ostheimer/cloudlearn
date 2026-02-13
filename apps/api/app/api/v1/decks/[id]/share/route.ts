import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { generateShareToken } from "@/services/deckService";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const { id } = await params;
    const result = await generateShareToken(id);
    return jsonOk(requestId, {
      requestId,
      shareToken: result.shareToken,
      shareUrl: `https://clearn.ai/deck/${result.shareToken}`,
    }, 201);
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
