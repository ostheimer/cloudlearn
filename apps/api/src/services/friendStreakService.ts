import { createSupabaseAdminClient } from "@/lib/supabase";
import { startOfTodayLocalIso, todayLocal } from "@/lib/localDay";
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

/** Longest display name we interpolate into a push body, ellipsis included. */
const DISPLAY_NAME_MAX = 40;

/**
 * `profiles.display_name` is bare text the client writes directly via PostgREST,
 * so it reaches us unvalidated and unbounded. Anything interpolated into a push
 * body must therefore be clamped: strip control/format characters (newlines,
 * zero-width and bidi-override spoofing tricks), collapse whitespace runs, and
 * cut to DISPLAY_NAME_MAX so a name cannot fake extra lines or push the real
 * text out of the notification.
 */
export function clampDisplayName(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const cleaned = raw
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (cleaned.length === 0) return fallback;
  if (cleaned.length <= DISPLAY_NAME_MAX) return cleaned;
  return `${cleaned.slice(0, DISPLAY_NAME_MAX - 1).trimEnd()}…`;
}

async function displayName(db: ReturnType<typeof getDb>, userId: string, fallback: string): Promise<string> {
  const { data } = await db.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  return clampDisplayName(data?.display_name, fallback);
}

/**
 * Claim today's single push slot for sender → recipient, atomically.
 *
 * Without a brake every call fires a push, so a friend can spam arbitrary text
 * at will. One conditional UPDATE both tests and stamps the slot, so two
 * concurrent calls cannot both win: PostgREST returns the updated row only when
 * the stamp was still unset or older than the start of the local day (Berlin,
 * #211 — not UTC). Returns false when this direction already pushed today.
 *
 * The stamp lives per direction (low/high) because the row covers the unordered
 * pair — A nudging B must not consume B's nudge back to A.
 */
async function claimDailyPush(
  db: ReturnType<typeof getDb>,
  senderId: string,
  recipientId: string
): Promise<boolean> {
  const low = senderId < recipientId ? senderId : recipientId;
  const high = senderId < recipientId ? recipientId : senderId;
  const column = senderId === low ? "last_reminded_at_low" : "last_reminded_at_high";
  const dayStart = startOfTodayLocalIso();

  const { data } = await db
    .from("friend_streaks")
    .update({ [column]: new Date().toISOString() })
    .eq("user_low", low)
    .eq("user_high", high)
    .or(`${column}.is.null,${column}.lt.${dayStart}`)
    .select("user_low");

  return (data ?? []).length > 0;
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

  // Notify the invitee so a fresh invite isn't missed (Etappe 2). Shares the
  // one-push-per-day slot with the reminder, so re-inviting cannot bypass it.
  if (result === "invited" && (await claimDailyPush(db, userId, friendId))) {
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

  // Pending: only the person who sent the invite may nudge the invitee.
  const eligible =
    streak.status === "active" || (streak.status === "pending" && streak.invited_by === userId);
  if (!eligible) return { sent: false };

  // Brake only once a push is actually warranted, so an ineligible nudge never
  // burns the day's slot. Same-day repeat → no push, `sent: false` (not an
  // error — the client already handles this shape).
  if (!(await claimDailyPush(db, userId, friendId))) return { sent: false };

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

  const sent = await pushToUser(
    db,
    friendId,
    "Freunde-Streak",
    `${name} wartet, dass du die Einladung annimmst.`,
    "friend_streak_invite"
  );
  return { sent };
}
