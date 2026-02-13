import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getDeckByShareToken } from "@/services/deckService";
import { listCardsForDeck } from "@/lib/db";

interface Params {
  params: Promise<{ token: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const { token } = await params;
    const deck = await getDeckByShareToken(token);
    if (!deck) {
      return jsonError(requestId, "DECK_NOT_FOUND", "Shared deck not found or link expired", 404);
    }
    // Include cards for the shared deck
    const cards = await listCardsForDeck(deck.userId, deck.id);
    return jsonOk(requestId, { requestId, deck, cards });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
