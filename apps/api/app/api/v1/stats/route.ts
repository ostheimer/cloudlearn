import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { listDecksForUser } from "@/services/deckService";
import { getDueCards } from "@/services/learnService";
import { getStreakInfo, getReviewStats, getLastStudiedDeck } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    // Whitelisted by-day window: exactly 7 or 30 days, everything else → 7.
    const days: 7 | 30 =
      new URL(request.url).searchParams.get("days") === "30" ? 30 : 7;

    const [decks, dueCards, streak, reviewStats, lastStudiedDeck] = await Promise.all([
      listDecksForUser(auth.userId),
      getDueCards(auth.userId),
      getStreakInfo(auth.userId),
      getReviewStats(auth.userId, days),
      getLastStudiedDeck(auth.userId),
    ]);

    return jsonOk(requestId, {
      requestId,
      stats: {
        totalDecks: decks.length,
        dueCards: dueCards.length,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        lastReviewDate: streak.lastReviewDate,
        dailyGoal: streak.dailyGoal,
        reviewsToday: reviewStats.reviewsToday,
        reviewsThisWeek: reviewStats.reviewsThisWeek,
        reviewsTotal: reviewStats.reviewsTotal,
        accuracyRate: reviewStats.accuracyRate,
        reviewsByDay: reviewStats.reviewsByDay,
        accuracyByDay: reviewStats.accuracyByDay,
        durationMsByDay: reviewStats.durationMsByDay,
        lastStudiedDeck,
      },
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
