import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { listDecksForUser } from "@/services/deckService";
import { getDueCards } from "@/services/learnService";
import { getStreakInfo, getReviewStats, getLastStudiedDeck } from "@/lib/db";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import { effectiveStatsWindowDays } from "@/lib/limits";

export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    // Whitelisted by-day window: exactly 7 or 30 days. Absent or invalid
    // values fall back to 30 — the historic window from before the param
    // existed — so old clients that send no `?days=` (and e.g. derive a
    // 14-day trend from the data) keep their full 30-day series.
    const requestedDays: 7 | 30 =
      new URL(request.url).searchParams.get("days") === "7" ? 7 : 30;

    // Advanced statistics (the 30-day history) is a Pro feature (#235). Free
    // users keep the full basic stats but are clamped to the 7-day window.
    const { tier } = await getSubscriptionStatus(auth.userId);
    const days = effectiveStatsWindowDays(tier, requestedDays);

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
        repairAvailable: streak.repairAvailable,
        repairBrokenStreak: streak.repairBrokenStreak,
        repairCost: streak.repairCost,
        reviewsToday: reviewStats.reviewsToday,
        reviewsThisWeek: reviewStats.reviewsThisWeek,
        reviewsTotal: reviewStats.reviewsTotal,
        reviewsInWindow: reviewStats.reviewsInWindow,
        accuracyRate: reviewStats.accuracyRate,
        // The window actually served, after the tier clamp — a Free account
        // asking for 30 gets 7. Clients label the accuracy with THIS, so the
        // label can't promise a month of data and show a week's.
        statsWindowDays: days,
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
