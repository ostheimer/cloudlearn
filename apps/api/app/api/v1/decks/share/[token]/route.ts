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
    const cards = await listCardsForDeck(deck.userId, deck.id);
    // Data minimization: a public share link must not expose internal IDs,
    // the owner's userId, or per-user learning (FSRS) state.
    const publicDeck = {
      title: deck.title,
      tags: deck.tags,
      cardCount: cards.length,
    };
    const publicCards = cards.map((card) => ({
      front: card.front,
      back: card.back,
      type: card.type,
    }));
    return jsonOk(requestId, { requestId, deck: publicDeck, cards: publicCards });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
