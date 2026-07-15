import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import {
  addDeckToFolderForUser,
  removeDeckFromFolderForUser,
  listDecksInFolderForUser,
} from "@/services/folderService";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const { id } = await params;
    const decks = await listDecksInFolderForUser(id, auth.userId);
    // null = folder not owned by the caller → 404 (don't leak existence).
    if (decks === null) {
      return jsonError(requestId, "FOLDER_NOT_FOUND", "Folder not found", 404);
    }
    return jsonOk(requestId, { requestId, decks });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const { id } = await params;
    const body = await request.json();
    const { deckId } = body;
    if (!deckId) {
      return jsonError(requestId, "VALIDATION_ERROR", "deckId is required", 422);
    }
    const ok = await addDeckToFolderForUser(id, auth.userId, deckId);
    if (!ok) {
      // Folder or deck not owned by the caller — 404 (don't reveal which, or
      // whether the resource exists).
      return jsonError(requestId, "FOLDER_NOT_FOUND", "Folder not found", 404);
    }
    return jsonOk(requestId, { requestId, added: true }, 201);
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
    const url = new URL(request.url);
    const deckId = url.searchParams.get("deckId");
    if (!deckId) {
      return jsonError(requestId, "VALIDATION_ERROR", "deckId query parameter is required", 422);
    }
    const ok = await removeDeckFromFolderForUser(id, auth.userId, deckId);
    if (!ok) {
      // Folder not owned by the caller → 404 (don't leak existence).
      return jsonError(requestId, "FOLDER_NOT_FOUND", "Folder not found", 404);
    }
    return jsonOk(requestId, { requestId, removed: true });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
