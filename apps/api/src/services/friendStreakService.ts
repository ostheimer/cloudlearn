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
  return { result: (data as string | null) ?? "invited" };
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
 * Nudge the partner of an active shared streak with a push notification.
 * Only works for a real, active pairing (so it can't be used to spam
 * arbitrary users), and is best-effort — a friend without a push token
 * simply receives nothing.
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
    .select("status")
    .eq("user_low", low)
    .eq("user_high", high)
    .eq("status", "active")
    .maybeSingle();
  if (!streak) return { sent: false };

  const [{ data: me }, { data: tokens }] = await Promise.all([
    db.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    db.from("push_tokens").select("token").eq("user_id", friendId),
  ]);

  const pushTokens = (tokens ?? []).map((t) => t.token as string);
  if (pushTokens.length === 0) return { sent: false };

  const senderName = me?.display_name ?? "Dein Lernbuddy";
  await sendExpoPushNotification(
    pushTokens.map((to) => ({
      to,
      title: "Euer gemeinsamer Streak",
      body: `${senderName} hat heute gelernt. Lern auch du, damit eure Flamme weiterbrennt!`,
      sound: "default" as const,
      data: { type: "friend_streak_reminder" },
    }))
  );
  return { sent: true };
}
