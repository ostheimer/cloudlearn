import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { createDeckForUser, listDecksForUser } from "@/services/deckService";
import { awardFirstDeckMilestone } from "@/services/lpService";

export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    // `?archived=1` liefert das Archiv statt der Bibliothek (#614). Ohne den
    // Parameter bleibt alles wie bisher — archivierte Decks fehlen dann, genau
    // dafür archiviert man sie.
    const archived = new URL(request.url).searchParams.get("archived") === "1";
    const decks = await listDecksForUser(auth.userId, { archived });
    return jsonOk(requestId, { requestId, decks });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}

export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const body = await request.json();
    const deck = await createDeckForUser({ ...body, userId: auth.userId });
    // „Erstes Deck erstellt" (#637): der Bonus hängt am Anlegen, nicht daran,
    // dass ein Client daran denkt. Nach dem Deck, damit eine klemmende
    // Gutschrift das Deck nicht verhindert.
    const milestones = await awardFirstDeckMilestone(auth.userId);
    return jsonOk(requestId, { requestId, deck, milestones }, 201);
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
