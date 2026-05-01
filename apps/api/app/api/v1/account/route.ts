import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { deleteAccount } from "@/services/accountDeletionService";

export async function DELETE(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const result = await deleteAccount(auth.userId, auth.email);
    return jsonOk(
      requestId,
      {
        requestId,
        deleted: true,
        message: result.message,
        ...(result.warning ? { warning: result.warning } : {}),
      },
      result.warning ? 202 : 200
    );
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
