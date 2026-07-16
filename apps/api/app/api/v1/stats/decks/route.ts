import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { getDeckReviewSummaries } from "@/lib/db";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import { effectiveStatsWindowDays } from "@/lib/limits";

/**
 * GET /api/v1/stats/decks — Pro-Deck-Zusammenfassungen für ALLE Decks der
 * Nutzerin in einem Aufruf (#246): Antworten + Genauigkeit der letzten
 * 30 Tage. Decks ohne Antworten sind mit answersTotal 0 enthalten, damit der
 * Client sie als "noch keine Antworten" ans Listenende sortieren kann.
 *
 * Das 30-Tage-Fenster ist die Pro-Statistik (#235): Free-Nutzerinnen bekommen
 * ihre Deck-Zusammenfassungen weiterhin, nur auf 7 Tage geklemmt.
 */
export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    // Tier resolved server-side (never from a client header/body); the helper
    // clamps non-entitled tiers down to 7 instead of rejecting them.
    const { tier } = await getSubscriptionStatus(auth.userId);
    const decks = await getDeckReviewSummaries(auth.userId, effectiveStatsWindowDays(tier, 30));

    return jsonOk(requestId, { requestId, decks });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
