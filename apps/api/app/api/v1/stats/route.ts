import { type NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { listDecksForUser } from "@/services/deckService";
import { getDueCards } from "@/services/learnService";

const querySchema = z.object({ userId: z.string().uuid() });

export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const query = querySchema.parse({ userId: request.nextUrl.searchParams.get("userId") });
    const decks = listDecksForUser(query.userId);
    const dueCards = getDueCards(query.userId);
    return jsonOk(requestId, {
      requestId,
      stats: {
        totalDecks: decks.length,
        dueCards: dueCards.length
      }
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
