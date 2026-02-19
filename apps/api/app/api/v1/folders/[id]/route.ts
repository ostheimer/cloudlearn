import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { getFolderById, updateFolderForUser, deleteFolderForUser } from "@/services/folderService";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const { id } = await params;
    const folder = await getFolderById(id);
    if (!folder) {
      return jsonError(requestId, "FOLDER_NOT_FOUND", "Folder not found", 404);
    }
    return jsonOk(requestId, { requestId, folder });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const body = await request.json();
    const { id } = await params;
    const folder = await updateFolderForUser({ ...body, folderId: id });
    if (!folder) {
      return jsonError(requestId, "FOLDER_NOT_FOUND", "Folder not found", 404);
    }
    return jsonOk(requestId, { requestId, folder });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const { id } = await params;
    const ok = await deleteFolderForUser(id);
    if (!ok) {
      return jsonError(requestId, "FOLDER_NOT_FOUND", "Folder not found", 404);
    }
    return jsonOk(requestId, { requestId, deleted: true });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
