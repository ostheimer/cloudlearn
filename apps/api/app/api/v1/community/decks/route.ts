import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { listCommunityDecks, publishCommunityDeck } from "@/services/communityDeckService";

export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  const status = request.nextUrl.searchParams.get("status");
  const decks = listCommunityDecks(status === "flagged" ? "flagged" : "approved");
  return jsonOk(requestId, { requestId, decks });
}

export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const body = await request.json();
    const deck = publishCommunityDeck(body);
    return jsonOk(requestId, { requestId, deck }, 201);
  } catch (error) {
    const normalized = normalizeError(error);
    const status = normalized.message === "COMMUNITY_PUBLISH_LIMIT_REACHED" ? 429 : normalized.status;
    const code = normalized.message === "COMMUNITY_PUBLISH_LIMIT_REACHED" ? "COMMUNITY_RATE_LIMITED" : normalized.code;
    return jsonError(requestId, code, normalized.message, status);
  }
}
