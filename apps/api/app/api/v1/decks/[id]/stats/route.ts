import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { getDeck, getDeckReviewStats, getDeckWobblyCards } from "@/lib/db";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import { getLimitsForTier } from "@/lib/featureGates";

interface Params {
  params: Promise<{ id: string }>;
}

// Wie viele Wackelkandidaten die Liste auf dem Bildschirm zeigt. Bleibt bei 5:
// Die Statistik-Seite soll kurz bleiben — und ausgelieferte App-Builds rendern
// `wobblyCards` ungefragt vollständig.
const WOBBLY_DISPLAY_LIMIT = 5;
// Wie viele Karten der "Alle üben"-Knopf höchstens startet (#682). Die Anzeige-
// Grenze war vorher unbemerkt auch die Lern-Grenze: Karte 6 und weiter waren
// über diesen Weg nie erreichbar, weil `wrongCount` all-time zählt und die
// vordersten 5 damit dauerhaft vorn bleiben. Eine Runde mit mehreren hundert
// Karten ist trotzdem keine Runde, darum diese ehrlich benannte Obergrenze.
const WOBBLY_PRACTICE_LIMIT = 100;

/**
 * GET /api/v1/decks/:id/stats — Statistik für EIN Deck (#246), Pro-only:
 * Antworten gesamt/richtig + Genauigkeits-Verlauf (gewähltes 7-/30-Tage-
 * Fenster, Standard 30) und die "Wackelkandidaten" (meist-falsch beantwortete
 * Karten, inkl. front/back, damit der Client eine Übungsrunde ohne weiteren
 * Fetch starten kann). Die Wackelkandidaten sind bewusst all-time, nicht
 * gefenstert. Free bekommt 403/PRO_REQUIRED (Laras Entscheidung 17.07.).
 *
 * Drei Felder zu den Wackelkandidaten (#682):
 *   wobblyCards         — die 5 für die Liste (unverändert für alte Clients)
 *   wobblyTotal         — wie viele Karten WIRKLICH mindestens einmal falsch waren
 *   wobblyPracticeCards — was "Alle üben" startet (bis WOBBLY_PRACTICE_LIMIT)
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

    // Die Deck-Statistik ist Pro-only (advancedStats) — wie der Deck-Vergleich
    // (/stats/decks): 403/PRO_REQUIRED statt 402, weil ausgelieferte
    // App-Builds bei 402 automatisch die Paywall öffnen (passive Ansicht).
    // Tier serverseitig, nie aus der Anfrage. Ownership-404 kommt davor, damit
    // fremde Decks für jeden Tarif gleich aussehen.
    const { tier } = await getSubscriptionStatus(auth.userId);
    if (!getLimitsForTier(tier).advancedStats) {
      return jsonError(requestId, "PRO_REQUIRED", "Deck statistics are part of Pro.", 403);
    }

    const [stats, wobbly] = await Promise.all([
      getDeckReviewStats(auth.userId, id, requestedDays),
      getDeckWobblyCards(auth.userId, id, WOBBLY_PRACTICE_LIMIT),
    ]);

    return jsonOk(requestId, {
      requestId,
      deck: { id: deck.id, title: deck.title },
      answersTotal: stats.answersTotal,
      answersCorrect: stats.answersCorrect,
      accuracyByDay: stats.accuracyByDay,
      // Die kurze Liste für die Anzeige — unverändert, damit alte App-Builds
      // weiter genau 5 Zeilen zeigen.
      wobblyCards: wobbly.cards.slice(0, WOBBLY_DISPLAY_LIMIT),
      // Die ehrliche Gesamtzahl: alle Karten des Decks mit mindestens einer
      // falschen Antwort. Neue Clients beschriften damit Liste und Knopf.
      wobblyTotal: wobbly.total,
      // Die Karten, die "Alle üben" wirklich startet (bis WOBBLY_PRACTICE_LIMIT).
      wobblyPracticeCards: wobbly.cards,
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
