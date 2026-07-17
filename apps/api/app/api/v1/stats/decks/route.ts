import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { getDeckReviewSummaries } from "@/lib/db";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import { getLimitsForTier } from "@/lib/featureGates";

/**
 * GET /api/v1/stats/decks — Deck-Vergleich (Zusammenfassungen für ALLE Decks
 * der Nutzerin in einem Aufruf, #246): Antworten + Genauigkeit der letzten
 * 30 Tage. Decks ohne Antworten sind mit answersTotal 0 enthalten, damit der
 * Client sie als "noch keine Antworten" ans Listenende sortieren kann.
 *
 * Der Deck-Vergleich ist Pro-only (advancedStats): 403/PRO_REQUIRED statt
 * 402/PAYWALL_REQUIRED, weil ausgelieferte App-Builds bei 402 automatisch die
 * Paywall öffnen — für eine passive Ansicht (Statistik-Tab) wäre das
 * aufdringlich. Clients zeigen bei diesem Code den Pro-Teaser.
 */
export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    // Tier resolved server-side (never from a client header/body).
    const { tier } = await getSubscriptionStatus(auth.userId);
    if (!getLimitsForTier(tier).advancedStats) {
      return jsonError(requestId, "PRO_REQUIRED", "Deck comparison is part of Pro statistics.", 403);
    }
    const decks = await getDeckReviewSummaries(auth.userId, 30);

    return jsonOk(requestId, { requestId, decks });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
