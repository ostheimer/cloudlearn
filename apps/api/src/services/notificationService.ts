import { createSupabaseAdminClient } from "@/lib/supabase";

// Sends Expo push notifications using the Expo Push API.
// No SDK needed — plain HTTP to https://exp.host/--/api/v2/push/send.

interface ExpoPushMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function sendExpoPushNotification(
  messages: ExpoPushMessage[]
): Promise<ExpoPushTicket[]> {
  const chunks: ExpoPushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  const allTickets: ExpoPushTicket[] = [];
  for (const chunk of chunks) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(chunk),
      });
      const json = (await response.json()) as { data: ExpoPushTicket[] };
      allTickets.push(...(json.data ?? []));
    } catch {
      // Push notifications are best-effort; don't throw
    }
  }
  return allTickets;
}

// Sends a streak-in-danger reminder to users whose friends haven't reviewed today.
// Intended to be called once per day (e.g. via cron at 18:00 local time).
export async function sendStreakAlertNotifications(): Promise<{ sent: number }> {
  const db = createSupabaseAdminClient();
  if (!db) return { sent: 0 };

  const today = new Date().toISOString().split("T")[0]!;

  // Find users who have a streak > 0 but haven't reviewed today
  const { data: atRiskUsers } = await db
    .from("profiles")
    .select("id, current_streak, display_name")
    .gt("current_streak", 0)
    .lt("last_review_date", today);

  if (!atRiskUsers || atRiskUsers.length === 0) return { sent: 0 };

  const atRiskIds = atRiskUsers.map((u) => u.id);

  // Find their friends who have reviewed today (the ones who might want to nudge them)
  const { data: friendConnections } = await db
    .from("friend_connections")
    .select("user_id, friend_id")
    .in("friend_id", atRiskIds);

  if (!friendConnections || friendConnections.length === 0) return { sent: 0 };

  // Friends who should receive the "your friend's streak is in danger" notification
  const friendsToNotify = [...new Set(friendConnections.map((c) => c.user_id))];

  // Get push tokens for those friends
  const { data: tokens } = await db
    .from("push_tokens")
    .select("user_id, token")
    .in("user_id", friendsToNotify);

  if (!tokens || tokens.length === 0) return { sent: 0 };

  // Build messages: one per token per friend-who-is-at-risk
  const messages: ExpoPushMessage[] = [];
  for (const { user_id, token } of tokens) {
    // Find which of their friends is at risk
    const atRiskFriendId = friendConnections.find((c) => c.user_id === user_id)?.friend_id;
    const atRiskFriend = atRiskUsers.find((u) => u.id === atRiskFriendId);
    if (!atRiskFriend) continue;

    const name = atRiskFriend.display_name ?? "Dein Freund";
    messages.push({
      to: token,
      title: "Streak in Gefahr! 🔥",
      body: `${name} hat heute noch nicht gelernt. Schick eine Nachricht und motiviere ihn!`,
      data: { type: "streak_alert", friendId: atRiskFriend.id },
      sound: "default",
      channelId: "streak-alerts",
    });
  }

  await sendExpoPushNotification(messages);
  return { sent: messages.length };
}

// Sends a direct streak-in-danger reminder to a user themselves.
export async function sendSelfStreakReminder(userId: string): Promise<void> {
  const db = createSupabaseAdminClient();
  if (!db) return;

  const { data: profile } = await db
    .from("profiles")
    .select("current_streak, display_name")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || (profile.current_streak ?? 0) === 0) return;

  const { data: tokens } = await db
    .from("push_tokens")
    .select("token")
    .eq("user_id", userId);

  if (!tokens || tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
    to: token,
    title: "Dein Streak wartet! 🔥",
    body: `Du hast einen ${profile.current_streak}-Tage-Streak. Lern heute, um ihn zu halten!`,
    data: { type: "self_streak_reminder" },
    sound: "default",
    channelId: "streak-alerts",
  }));

  await sendExpoPushNotification(messages);
}
