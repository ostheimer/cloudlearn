import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { getDeck, getDeckReviewStats, getDeckWobblyCards } from "@/lib/db";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import { effectiveStatsWindowDays } from "@/lib/limits";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/decks/:id/stats — Statistik für EIN Deck (#246):
 * Antworten gesamt/richtig + Genauigkeits-Verlauf (gewähltes 7-/30-Tage-
 * Fenster, Standard 30) und die "Wackelkandidaten" (meist-falsch beantwortete
 * Karten, inkl. front/back, damit der Client eine Übungsrunde ohne weiteren
 * Fetch starten kann). Die Wackelkandidaten sind bewusst all-time, nicht
 * gefenstert.
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

    // Whitelisted trend window: exactly 7 or 30 days. Absent or invalid values
    // fall back to 30 — the historic window from before the param existed — so
    // old clients that send no `?days=` keep their full 30-day series (mirrors
    // the /api/v1/stats fix in #253). Only the accuracy trend is windowed; the
    // Wackelkandidaten stay all-time.
    const requestedDays: 7 | 30 =
      new URL(request.url).searchParams.get("days") === "7" ? 7 : 30;

    // Advanced statistics (the 30-day history) is a Pro feature (#235). Free
    // users keep the full deck stats but are clamped to the 7-day window — the
    // tier is resolved server-side, never taken from the request.
    const { tier } = await getSubscriptionStatus(auth.userId);
    const days = effectiveStatsWindowDays(tier, requestedDays);

    const [stats, wobblyCards] = await Promise.all([
      getDeckReviewStats(auth.userId, id, days),
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
