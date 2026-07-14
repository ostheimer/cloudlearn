import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { getDeck, getDeckReviewStats, getDeckWobblyCards } from "@/lib/db";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/decks/:id/stats — Statistik für EIN Deck (#246):
 * Antworten gesamt/richtig + Genauigkeits-Verlauf (letzte 30 Tage) und die
 * "Wackelkandidaten" (meist-falsch beantwortete Karten, inkl. front/back,
 * damit der Client eine Übungsrunde ohne weiteren Fetch starten kann).
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const { id } = await params;
    // Ownership gate: the admin client bypasses RLS, so the deck is fetched
    // by id AND user_id — a foreign or missing deck is indistinguishable.
    const deck = await getDeck(id, auth.userId);
    if (!deck) {
      return jsonError(requestId, "DECK_NOT_FOUND", "Deck not found", 404);
    }

    const [stats, wobblyCards] = await Promise.all([
      getDeckReviewStats(auth.userId, id, 30),
      getDeckWobblyCards(auth.userId, id, 5),
    ]);

    return jsonOk(requestId, {
      requestId,
      deck: { id: deck.id, title: deck.title },
      answersTotal: stats.answersTotal,
      answersCorrect: stats.answersCorrect,
      accuracyByDay: stats.accuracyByDay,
      wobblyCards,
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
