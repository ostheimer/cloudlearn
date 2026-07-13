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

    // Whitelisted by-day window: exactly 7 or 30 days. Absent or invalid
    // values fall back to 30 — the historic window from before the param
    // existed — so old clients that send no `?days=` (and e.g. derive a
    // 14-day trend from the data) keep their full 30-day series.
    const days: 7 | 30 =
      new URL(request.url).searchParams.get("days") === "7" ? 7 : 30;

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
        streakFreezes: streak.streakFreezes,
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
