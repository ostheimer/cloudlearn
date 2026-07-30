import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { duplicateDeckForUser } from "@/services/deckService";
import { awardFirstDeckMilestone } from "@/services/lpService";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const { id } = await params;
    const deck = await duplicateDeckForUser(auth.userId, id);
    // Auch eine Kopie ist ein neues Deck (#637). In der Praxis ist der Bonus
    // hier längst eingelöst — man kopiert nur, was man schon hat —, aber der
    // Meilenstein hängt am Ereignis, nicht an dem Weg dorthin.
    const milestones = await awardFirstDeckMilestone(auth.userId);
    return jsonOk(requestId, { requestId, deck, milestones }, 201);
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
