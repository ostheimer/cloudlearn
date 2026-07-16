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

    // Data minimisation: the client gets no raw user ids — "is this me?" is
    // decided server-side (isCurrentUser), everything else is display data.
    const entries = (topUsers ?? []).map((u, index) => ({
      rank: index + 1,
      displayName: u.display_name ?? "Lernender",
      avatarUrl: u.avatar_url ?? null,
      lpBalance: u.lp_balance ?? 0,
      tier: u.subscription_tier ?? "free",
      currentStreak: u.current_streak ?? 0,
      isCurrentUser: u.id === auth.userId,
    }));

    // Own rank, case 1: the caller is on the visible board, so their rank is
    // simply their position in it. Reading it off the list (instead of counting
    // again) guarantees the displayed list and myRank can never disagree when
    // balances tie.
    const ownEntry = entries.find((e) => e.isCurrentUser);
    let myRank: number | null = ownEntry?.rank ?? null;

    if (!ownEntry) {
      // Own rank, case 2: outside the top 50 the rank has to be counted, which
      // needs the caller's own balance — read it directly. Deriving it from the
      // top-50 array returns `undefined` for precisely the users who need the
      // count, and the old `?? 0` fallback then counted every profile above
      // 0 LP. Since lp_balance is NOT NULL DEFAULT 10, that was almost the
      // whole table: everyone outside the top 50 saw `myRank = totalUsers + 1`.
      const { data: me, error: meError } = await db
        .from("profiles")
        .select("lp_balance")
        .eq("id", auth.userId)
        .maybeSingle();

      if (meError) throw new Error(`leaderboard/global: ${meError.message}`);

      if (me) {
        // `?? 0` only narrows the type here — the column is NOT NULL, and the
        // row is known to exist, so this can never stand in for a missing user.
        const myBalance = me.lp_balance ?? 0;
        const { count: usersAbove, error: countError } = await db
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gt("lp_balance", myBalance);

        if (countError) throw new Error(`leaderboard/global: ${countError.message}`);

        myRank = (usersAbove ?? 0) + 1;
      }
      // No profile row (should not happen — getAuthUser upserts one on every
      // authenticated request): report an explicit "unknown" rather than
      // inventing a rank from a fake 0 balance. Both clients already hide the
      // rank line for a non-positive/absent myRank.
    }

    return jsonOk(requestId, { entries, myRank, total: entries.length });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
