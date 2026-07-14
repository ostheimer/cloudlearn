import { z } from "zod";
import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import {
  listFriendStreaks,
  inviteFriendStreak,
  acceptFriendStreak,
  remindFriendStreak,
  leaveFriendStreak,
} from "@/services/friendStreakService";

const postSchema = z.object({
  friendId: z.string().uuid(),
  action: z.enum(["invite", "accept", "remind"]),
});

// GET /api/v1/friends/streaks — all shared streaks (active + pending) for the user.
export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);
    const streaks = await listFriendStreaks(auth.userId);
    return jsonOk(requestId, { streaks });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}

// POST /api/v1/friends/streaks — invite a friend, accept an invite, or remind a partner.
export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return jsonError(requestId, "VALIDATION_ERROR", parsed.error.message, 400);
    const { friendId, action } = parsed.data;

    if (action === "invite") {
      const { result } = await inviteFriendStreak(auth.userId, friendId);
      if (result === "not_friends") {
        return jsonError(requestId, "NOT_FRIENDS", "You can only start a streak with a friend.", 400);
      }
      if (result === "self") {
        return jsonError(requestId, "SELF_STREAK", "You cannot start a streak with yourself.", 400);
      }
      return jsonOk(requestId, { result });
    }

    if (action === "accept") {
      const { accepted } = await acceptFriendStreak(auth.userId, friendId);
      if (!accepted) return jsonError(requestId, "NO_INVITE", "No pending invite to accept.", 409);
      return jsonOk(requestId, { accepted: true });
    }

    // remind
    const { sent } = await remindFriendStreak(auth.userId, friendId);
    return jsonOk(requestId, { sent });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}

// DELETE /api/v1/friends/streaks?friendId=... — leave / cancel a shared streak.
export async function DELETE(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const friendId = z.string().uuid().safeParse(new URL(request.url).searchParams.get("friendId"));
    if (!friendId.success) {
      return jsonError(requestId, "INVALID_REQUEST", "friendId must be a valid UUID", 400);
    }
    await leaveFriendStreak(auth.userId, friendId.data);
    return jsonOk(requestId, { left: true });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
