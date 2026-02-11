import { type NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { createDeckForUser, listDecksForUser } from "@/services/deckService";

const userQuerySchema = z.object({
  userId: z.string().uuid()
});

export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const query = userQuerySchema.parse({
      userId: request.nextUrl.searchParams.get("userId")
    });
    return jsonOk(requestId, { requestId, decks: listDecksForUser(query.userId) });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}

export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const body = await request.json();
    const deck = createDeckForUser(body);
    return jsonOk(requestId, { requestId, deck }, 201);
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
