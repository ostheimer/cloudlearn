import { type NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { API_RATE_LIMITS, enforceUserRateLimit } from "@/lib/apiRateLimit";
import { restoreCardForUser, restoreDeckForUser } from "@/services/trashService";

/**
 * Genau eines von beiden: ein Deck ODER eine Karte. Beides zugleich wäre eine
 * stille Halb-Ausführung — welcher der zwei Aufträge zählt, könnte der Client
 * nicht an der Antwort ablesen.
 */
const requestSchema = z
  .object({
    deckId: z.string().uuid().optional(),
    cardId: z.string().uuid().optional(),
  })
  .refine((v) => (v.deckId ? !v.cardId : !!v.cardId), {
    message: "Entweder deckId oder cardId angeben, nicht beides",
  });

/** Gelöschtes Deck oder gelöschte Karte zurückholen (#614). */
export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);
    await enforceUserRateLimit(auth.userId, "trash-restore", API_RATE_LIMITS.trashRestore);

    const parsed = requestSchema.parse(await request.json());

    if (parsed.deckId) {
      const ok = await restoreDeckForUser(auth.userId, parsed.deckId);
      if (!ok) return jsonError(requestId, "DECK_NOT_FOUND", "Deck not in trash", 404);
      return jsonOk(requestId, { requestId, restored: "deck" });
    }

    const ok = await restoreCardForUser(auth.userId, parsed.cardId!);
    if (!ok) return jsonError(requestId, "CARD_NOT_FOUND", "Card not in trash", 404);
    return jsonOk(requestId, { requestId, restored: "card" });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
