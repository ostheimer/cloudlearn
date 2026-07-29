import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const db = createSupabaseAdminClient();
    if (!db) return jsonError(requestId, "DB_UNAVAILABLE", "Database not configured", 503);

    // Get all friend IDs (bidirectional)
    const { data: connections } = await db
      .from("friend_connections")
      .select("friend_id")
      .eq("user_id", auth.userId);

    const friendIds = (connections ?? []).map((c) => c.friend_id);
    // Include the current user in their own leaderboard
    const allIds = [auth.userId, ...friendIds];

    // Zweitschlüssel wie beim globalen Board: bei LP-Gleichstand sonst
    // wechselnde Reihenfolge je Aufruf (#612).
    const { data: profiles, error } = await db
      .from("profiles")
      .select("id, display_name, avatar_url, lp_balance, subscription_tier, current_streak")
      .in("id", allIds)
      .order("lp_balance", { ascending: false })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw new Error(`leaderboard/friends: ${error.message}`);

    const entries = (profiles ?? []).map((u, index) => ({
      rank: index + 1,
      userId: u.id,
      displayName: u.display_name ?? "Lernender",
      avatarUrl: u.avatar_url ?? null,
      lpBalance: u.lp_balance ?? 0,
      tier: u.subscription_tier ?? "free",
      currentStreak: u.current_streak ?? 0,
      isCurrentUser: u.id === auth.userId,
    }));

    return jsonOk(requestId, { entries, friendCount: friendIds.length });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
