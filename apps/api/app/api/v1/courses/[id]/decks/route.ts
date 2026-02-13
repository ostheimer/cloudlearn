import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import {
  addDeckToCourseForUser,
  removeDeckFromCourseForUser,
  listDecksInCourseForUser,
} from "@/services/courseService";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const { id } = await params;
    const decks = await listDecksInCourseForUser(id);
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
    const { deckId, position } = body;
    if (!deckId) {
      return jsonError(requestId, "VALIDATION_ERROR", "deckId is required", 422);
    }
    const ok = await addDeckToCourseForUser(id, deckId, position ?? 0);
    if (!ok) {
      return jsonError(requestId, "ADD_FAILED", "Could not add deck to course", 400);
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
    const ok = await removeDeckFromCourseForUser(id, deckId);
    if (!ok) {
      return jsonError(requestId, "REMOVE_FAILED", "Could not remove deck from course", 400);
    }
    return jsonOk(requestId, { requestId, removed: true });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
