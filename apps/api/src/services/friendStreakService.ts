import { createSupabaseAdminClient } from "@/lib/supabase";
import { todayLocal } from "@/lib/localDay";
import { sendExpoPushNotification } from "@/services/notificationService";

function getDb() {
  const client = createSupabaseAdminClient();
  if (!client) throw new Error("Supabase not configured.");
  return client;
}

export interface FriendStreakEntry {
  friendId: string;
  displayName: string;
  avatarUrl: string | null;
  status: "pending" | "active";
  currentStreak: number;
  longestStreak: number;
  // True once this user has studied today; drives the "du bist dran" hint.
  youStudiedToday: boolean;
  friendStudiedToday: boolean;
  // Pending invites: whether this user sent it (waiting) or must accept it.
  invitedByYou: boolean;
}

interface FriendStreakRow {
  user_low: string;
  user_high: string;
  status: "pending" | "active";
  invited_by: string;
  current_streak: number;
  longest_streak: number;
  last_day_low: string | null;
  last_day_high: string | null;
}

/** All shared streaks (active and pending) the user is part of. */
export async function listFriendStreaks(userId: string): Promise<FriendStreakEntry[]> {
  const db = getDb();
  const { data, error } = await db
    .from("friend_streaks")
    .select("user_low, user_high, status, invited_by, current_streak, longest_streak, last_day_low, last_day_high")
    .or(`user_low.eq.${userId},user_high.eq.${userId}`);
  if (error) throw new Error(`listFriendStreaks: ${error.message}`);

  const rows = (data ?? []) as FriendStreakRow[];
  if (rows.length === 0) return [];

  const friendIds = rows.map((r) => (r.user_low === userId ? r.user_high : r.user_low));
  const { data: profiles } = await db
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", friendIds);
  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id as string, p as { display_name?: string; avatar_url?: string | null }])
  );

  const today = todayLocal();
  return rows.map((r) => {
    const userIsLow = r.user_low === userId;
    const friendId = userIsLow ? r.user_high : r.user_low;
    const youDay = userIsLow ? r.last_day_low : r.last_day_high;
    const friendDay = userIsLow ? r.last_day_high : r.last_day_low;
    const profile = profileById.get(friendId);
    return {
      friendId,
      displayName: profile?.display_name ?? "Lernbuddy",
      avatarUrl: profile?.avatar_url ?? null,
      status: r.status,
      currentStreak: r.current_streak,
      longestStreak: r.longest_streak,
      youStudiedToday: youDay === today,
      friendStudiedToday: friendDay === today,
      invitedByYou: r.invited_by === userId,
    };
  });
}

// Best-effort push to one user's registered devices. Never throws — a missing
// token or a push failure must not break the action that triggered it.
async function pushToUser(
  db: ReturnType<typeof getDb>,
  toUserId: string,
  title: string,
  body: string,
  type: string
): Promise<boolean> {
  try {
    const { data: tokens } = await db.from("push_tokens").select("token").eq("user_id", toUserId);
    const pushTokens = (tokens ?? []).map((t) => t.token as string);
    if (pushTokens.length === 0) return false;
    await sendExpoPushNotification(
      pushTokens.map((to) => ({ to, title, body, sound: "default" as const, data: { type } }))
    );
    return true;
  } catch {
    return false;
  }
}

async function displayName(db: ReturnType<typeof getDb>, userId: string, fallback: string): Promise<string> {
  const { data } = await db.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  return data?.display_name ?? fallback;
}

export async function inviteFriendStreak(
  userId: string,
  friendId: string
): Promise<{ result: string }> {
  const db = getDb();
  const { data, error } = await db.rpc("invite_friend_streak", {
    p_inviter: userId,
    p_invitee: friendId,
  });
  if (error) throw new Error(`inviteFriendStreak: ${error.message}`);
  const result = (data as string | null) ?? "invited";

  // Notify the invitee so a fresh invite isn't missed (Etappe 2).
  if (result === "invited") {
    const name = await displayName(db, userId, "Ein Freund");
    await pushToUser(
      db,
      friendId,
      "Neuer Freunde-Streak",
      `${name} lädt dich zu einem gemeinsamen Streak ein.`,
      "friend_streak_invite"
    );
  }
  return { result };
}

export async function acceptFriendStreak(
  userId: string,
  friendId: string
): Promise<{ accepted: boolean }> {
  const db = getDb();
  const { data, error } = await db.rpc("accept_friend_streak", {
    p_user: userId,
    p_other: friendId,
  });
  if (error) throw new Error(`acceptFriendStreak: ${error.message}`);
  return { accepted: Boolean(data) };
}

export async function leaveFriendStreak(userId: string, friendId: string): Promise<void> {
  const db = getDb();
  const low = userId < friendId ? userId : friendId;
  const high = userId < friendId ? friendId : userId;
  const { error } = await db
    .from("friend_streaks")
    .delete()
    .eq("user_low", low)
    .eq("user_high", high);
  if (error) throw new Error(`leaveFriendStreak: ${error.message}`);
}

/**
 * Nudge the partner of a shared streak with a push notification. Two cases,
 * both only for a real pairing (so it can't spam arbitrary users):
 *  - active streak → "I studied, your turn".
 *  - pending invite (only the inviter may nudge) → "please accept".
 * Best-effort — a friend without a push token simply receives nothing.
 */
export async function remindFriendStreak(
  userId: string,
  friendId: string
): Promise<{ sent: boolean }> {
  const db = getDb();
  const low = userId < friendId ? userId : friendId;
  const high = userId < friendId ? friendId : userId;

  const { data: streak } = await db
    .from("friend_streaks")
    .select("status, invited_by")
    .eq("user_low", low)
    .eq("user_high", high)
    .maybeSingle();
  if (!streak) return { sent: false };

  const name = await displayName(db, userId, "Dein Lernbuddy");

  if (streak.status === "active") {
    const sent = await pushToUser(
      db,
      friendId,
      "Euer gemeinsamer Streak",
      `${name} hat heute gelernt. Lern auch du, damit eure Flamme weiterbrennt!`,
      "friend_streak_reminder"
    );
    return { sent };
  }

  // Pending: only the person who sent the invite can nudge the invitee.
  if (streak.status === "pending" && streak.invited_by === userId) {
    const sent = await pushToUser(
      db,
      friendId,
      "Freunde-Streak",
      `${name} wartet, dass du die Einladung annimmst.`,
      "friend_streak_invite"
    );
    return { sent };
  }

  return { sent: false };
}
