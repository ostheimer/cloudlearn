import { z } from "zod";
import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { LP_EARN_RULES, REFERRAL_SENDER_CAP } from "@/lib/featureGates";
import { type Gender } from "@/services/genderService";

const REFERRAL_FAILURES = ["already_referred", "code_not_found", "self", "claimer_not_found"];

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
      .select("id, display_name, avatar_url, gender")
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

    // Adding a friend by code also grants the one-time referral LP bonus (this
    // merges the old separate "Empfehlung einlösen" flow). Best-effort: the
    // atomic claim_referral guards already_referred/self, so a second friend
    // simply adds no LP — the friendship above always stands regardless.
    let lpGranted = 0;
    let newBalance: number | undefined;
    try {
      const { data: claim } = await db.rpc("claim_referral", {
        p_claimer: auth.userId,
        p_code: body.data.code,
        p_referrer_bonus: LP_EARN_RULES.referralSender,
        p_claimer_bonus: LP_EARN_RULES.referralReceiver,
        p_referrer_cap: REFERRAL_SENDER_CAP,
      });
      if (claim && !REFERRAL_FAILURES.includes(claim.status)) {
        lpGranted = claim.claimerBonus ?? 0;
        newBalance = claim.newBalance;
      }
    } catch {
      // LP is a bonus, never a blocker — the friendship is already created.
    }

    return jsonOk(requestId, {
      added: true,
      friend: {
        userId: friend.id as string,
        displayName: (friend.display_name as string | null) ?? "Lernbuddy",
        avatarUrl: (friend.avatar_url as string | null) ?? null,
        // Fürs Wording der Erfolgsmeldung („… ist jetzt deine Freundin/dein
        // Freund"); null → neutrale Form.
        gender: (friend.gender as Gender | null) ?? null,
      },
      lpGranted,
      newBalance,
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
