import { z } from "zod";
import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

const addFriendSchema = z.object({
  friendId: z.string().uuid(),
});

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

// POST /api/v1/friends — add a friend by userId (typically after referral)
export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const body = addFriendSchema.safeParse(await request.json());
    if (!body.success) return jsonError(requestId, "INVALID_REQUEST", body.error.message, 400);

    const { friendId } = body.data;
    if (friendId === auth.userId) {
      return jsonError(requestId, "SELF_FRIEND", "Cannot add yourself as a friend", 400);
    }

    const db = createSupabaseAdminClient();
    if (!db) return jsonError(requestId, "DB_UNAVAILABLE", "Database not configured", 503);

    // Verify friend exists
    const { data: friendProfile } = await db
      .from("profiles")
      .select("id")
      .eq("id", friendId)
      .maybeSingle();

    if (!friendProfile) return jsonError(requestId, "USER_NOT_FOUND", "User not found", 404);

    // Add bidirectional connection (upsert to avoid duplicate errors)
    await db.from("friend_connections").upsert([
      { user_id: auth.userId, friend_id: friendId },
      { user_id: friendId, friend_id: auth.userId },
    ], { onConflict: "user_id,friend_id" });

    return jsonOk(requestId, { added: true, friendId });
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

    const friendId = new URL(request.url).searchParams.get("friendId");
    if (!friendId) return jsonError(requestId, "INVALID_REQUEST", "friendId is required", 400);

    const db = createSupabaseAdminClient();
    if (!db) return jsonError(requestId, "DB_UNAVAILABLE", "Database not configured", 503);

    await db.from("friend_connections")
      .delete()
      .or(`and(user_id.eq.${auth.userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${auth.userId})`);

    return jsonOk(requestId, { removed: true });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
