import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { importSharedDeck } from "@/services/deckService";
import { awardFirstDeckMilestone } from "@/services/lpService";

interface Params {
  params: Promise<{ token: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const { token } = await params;
    const { deck } = await importSharedDeck(auth.userId, token);
    // Ein übernommenes Deck kann sehr wohl das erste sein: Wer über einen
    // geteilten Link zu clearn kommt, startet genau so (#637).
    const milestones = await awardFirstDeckMilestone(auth.userId);
    return jsonOk(requestId, { requestId, deck, milestones }, 201);
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
