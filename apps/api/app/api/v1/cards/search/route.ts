import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { searchCardsForUser } from "@/lib/db";

// Card search for the Bibliothek: finds the caller's own cards by front/back
// text. Ownership is enforced in the query (cards.user_id = auth user).
export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) {
      return jsonOk(requestId, { requestId, results: [] });
    }

    const results = await searchCardsForUser(auth.userId, q);
    return jsonOk(requestId, { requestId, results });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
