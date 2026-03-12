import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const db = createSupabaseAdminClient();
    if (!db) return jsonError(requestId, "DB_UNAVAILABLE", "Database not configured", 503);

    // Top 50 users by LP balance
    const { data: topUsers, error } = await db
      .from("profiles")
      .select("id, display_name, avatar_url, lp_balance, subscription_tier, current_streak")
      .order("lp_balance", { ascending: false })
      .limit(PAGE_SIZE);

    if (error) throw new Error(`leaderboard/global: ${error.message}`);

    // Find current user's rank
    const { count: userRank } = await db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gt("lp_balance", topUsers?.find((u) => u.id === auth.userId)?.lp_balance ?? 0);

    const entries = (topUsers ?? []).map((u, index) => ({
      rank: index + 1,
      userId: u.id,
      displayName: u.display_name ?? "Lernender",
      avatarUrl: u.avatar_url ?? null,
      lpBalance: u.lp_balance ?? 0,
      tier: u.subscription_tier ?? "free",
      currentStreak: u.current_streak ?? 0,
      isCurrentUser: u.id === auth.userId,
    }));

    const myRank = (userRank ?? 0) + 1;

    return jsonOk(requestId, { entries, myRank, total: PAGE_SIZE });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
