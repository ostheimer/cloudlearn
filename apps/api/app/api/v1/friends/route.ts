import { z } from "zod";
import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

// Adding a friend goes through POST /api/v1/friends/by-code only: the share
// code is the capability you deliberately hand out. A raw-UUID add was
// removed — every friend already learns your UUID from GET /friends, so it let
// a removed friend re-add themselves instantly and made unfriending
// unenforceable.
const friendIdSchema = z.string().uuid();

// GET /api/v1/friends — list all friends with LP/streak
export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const db = createSupabaseAdminClient();
    if (!db) return jsonError(requestId, "DB_UNAVAILABLE", "Database not configured", 503);

    const { data: connections } = await db
      .from("friend_connections")
      .select("friend_id")
      .eq("user_id", auth.userId);

    const friendIds = (connections ?? []).map((c) => c.friend_id);
    if (friendIds.length === 0) return jsonOk(requestId, { friends: [] });

    const { data: profiles, error } = await db
      .from("profiles")
      .select("id, display_name, avatar_url, lp_balance, current_streak, last_review_date")
      .in("id", friendIds);

    if (error) throw new Error(`friends GET: ${error.message}`);

    const friends = (profiles ?? []).map((p) => ({
      userId: p.id,
      displayName: p.display_name ?? "Lernender",
      avatarUrl: p.avatar_url ?? null,
      lpBalance: p.lp_balance ?? 0,
      currentStreak: p.current_streak ?? 0,
      lastReviewDate: p.last_review_date ?? null,
      // Streak in danger: last review was not today
      streakInDanger: Boolean(p.last_review_date && p.last_review_date < new Date().toISOString().split("T")[0]!),
    }));

    return jsonOk(requestId, { friends });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}

// DELETE /api/v1/friends?friendId=... — remove a friend
export async function DELETE(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    // Validate as UUID before use — friendId is interpolated into a PostgREST
    // `.or()` filter on the service-role client, so unvalidated input could
    // smuggle extra filter syntax into the query.
    const friendIdParam = friendIdSchema.safeParse(
      new URL(request.url).searchParams.get("friendId")
    );
    if (!friendIdParam.success) {
      return jsonError(requestId, "INVALID_REQUEST", "friendId must be a valid UUID", 400);
    }
    const friendId = friendIdParam.data;

    const db = createSupabaseAdminClient();
    if (!db) return jsonError(requestId, "DB_UNAVAILABLE", "Database not configured", 503);

    await db.from("friend_connections")
      .delete()
      .or(`and(user_id.eq.${auth.userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${auth.userId})`);

    // Unfriending ends any shared streak too (Etappe 4) — the canonical pair is
    // (low < high). Leaving it behind would strand a streak with a non-friend.
    const low = auth.userId < friendId ? auth.userId : friendId;
    const high = auth.userId < friendId ? friendId : auth.userId;
    await db.from("friend_streaks").delete().eq("user_low", low).eq("user_high", high);

    return jsonOk(requestId, { removed: true });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
