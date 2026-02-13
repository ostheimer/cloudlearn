import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { createFolderForUser, listFoldersForUser } from "@/services/folderService";

export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const folders = await listFoldersForUser(auth.userId);
    return jsonOk(requestId, { requestId, folders });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}

export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const body = await request.json();
    const folder = await createFolderForUser({ ...body, userId: auth.userId });
    return jsonOk(requestId, { requestId, folder }, 201);
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
