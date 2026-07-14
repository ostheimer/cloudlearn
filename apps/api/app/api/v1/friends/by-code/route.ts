import { z } from "zod";
import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

// Codes are the existing referral codes (8-char uppercase). Restrict to
// [A-Z0-9] so the value is safe to match exactly and can't smuggle wildcards.
const schema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,20}$/),
});

// POST /api/v1/friends/by-code { code } — add a friend by their share code.
// Reuses profiles.referral_code as a friend code; creates the bidirectional
// friendship immediately (clearn has no friend-request step — the accept step
// exists only for shared streaks). Idempotent.
export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const body = schema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) {
      return jsonError(requestId, "INVALID_CODE", "Ungültiges Code-Format.", 400);
    }

    const db = createSupabaseAdminClient();
    if (!db) return jsonError(requestId, "DB_UNAVAILABLE", "Database not configured", 503);

    const { data: friend } = await db
      .from("profiles")
      .select("id, display_name, avatar_url")
      .eq("referral_code", body.data.code)
      .maybeSingle();

    if (!friend) return jsonError(requestId, "CODE_NOT_FOUND", "Diesen Code gibt es nicht.", 404);
    if (friend.id === auth.userId) {
      return jsonError(requestId, "SELF_ADD", "Das ist dein eigener Code.", 400);
    }

    const { error } = await db.from("friend_connections").upsert(
      [
        { user_id: auth.userId, friend_id: friend.id },
        { user_id: friend.id, friend_id: auth.userId },
      ],
      { onConflict: "user_id,friend_id" }
    );
    if (error) throw new Error(`addFriendByCode: ${error.message}`);

    return jsonOk(requestId, {
      added: true,
      friend: {
        userId: friend.id as string,
        displayName: (friend.display_name as string | null) ?? "Lernbuddy",
        avatarUrl: (friend.avatar_url as string | null) ?? null,
      },
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
