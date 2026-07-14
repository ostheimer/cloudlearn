import { createSupabaseAdminClient } from "@/lib/supabase";
import { todayLocal } from "@/lib/localDay";

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

interface FriendStreakRow {
  user_low: string;
  user_high: string;
  last_day_low: string | null;
  last_day_high: string | null;
  current_streak: number | null;
}
interface ProfileRow {
  id: string;
  current_streak: number | null;
  last_review_date: string | null;
  display_name: string | null;
}

/**
 * Evening reminder — one bundled push per user about *their own* streaks in
 * danger today (Etappe 4): the personal streak they haven't kept, plus any
 * shared friend streak whose today's slot they still owe. Deliberately at most
 * one message per device (the old version sent one per at-risk friend, which
 * could spam). Meant to run once a day via the streak-alerts cron.
 */
export async function sendStreakAlertNotifications(): Promise<{ sent: number }> {
  const db = createSupabaseAdminClient();
  if (!db) return { sent: 0 };

  // Streak days follow the user's local day, not UTC (#211).
  const today = todayLocal();

  const { data: tokenRows } = await db.from("push_tokens").select("user_id, token");
  if (!tokenRows || tokenRows.length === 0) return { sent: 0 };

  const tokensByUser = new Map<string, string[]>();
  for (const r of tokenRows) {
    const list = tokensByUser.get(r.user_id) ?? [];
    list.push(r.token);
    tokensByUser.set(r.user_id, list);
  }
  const userIds = [...tokensByUser.keys()];

  // All active shared streaks (small table) — filtered per user in memory.
  const { data: fsRowsRaw } = await db
    .from("friend_streaks")
    .select("user_low, user_high, last_day_low, last_day_high, current_streak")
    .eq("status", "active");
  const fsRows = (fsRowsRaw ?? []) as FriendStreakRow[];

  // Profiles for everyone we might name or check (token users + their partners).
  const nameIds = new Set<string>(userIds);
  for (const fs of fsRows) { nameIds.add(fs.user_low); nameIds.add(fs.user_high); }
  const { data: profRows } = await db
    .from("profiles")
    .select("id, current_streak, last_review_date, display_name")
    .in("id", [...nameIds]);
  const profById = new Map<string, ProfileRow>(
    (profRows ?? []).map((p) => [p.id as string, p as ProfileRow])
  );

  const messages: ExpoPushMessage[] = [];
  for (const uid of userIds) {
    const me = profById.get(uid);
    if (!me) continue;

    const personalAtRisk =
      (me.current_streak ?? 0) > 0 && (me.last_review_date == null || me.last_review_date < today);

    // Shared streaks where I still owe today's slot and the streak is worth
    // saving (already running, or the partner already did their part today).
    const sharedAtRisk = fsRows.filter((fs) => {
      const iAmLow = fs.user_low === uid;
      if (!iAmLow && fs.user_high !== uid) return false;
      const myDay = iAmLow ? fs.last_day_low : fs.last_day_high;
      if (myDay === today) return false;
      const partnerDay = iAmLow ? fs.last_day_high : fs.last_day_low;
      return (fs.current_streak ?? 0) > 0 || partnerDay === today;
    });

    const total = (personalAtRisk ? 1 : 0) + sharedAtRisk.length;
    if (total === 0) continue;

    let body: string;
    if (total > 1) {
      body = `${total} deiner Streaks sind heute in Gefahr. Lern jetzt, um sie zu halten.`;
    } else if (personalAtRisk) {
      body = `Dein ${me.current_streak}-Tage-Streak wartet. Lern heute, um ihn zu halten.`;
    } else {
      const fs = sharedAtRisk[0]!;
      const partnerId = fs.user_low === uid ? fs.user_high : fs.user_low;
      const partnerName = profById.get(partnerId)?.display_name ?? "deinem Lernbuddy";
      body = `Eure gemeinsame Flamme mit ${partnerName} braucht dich heute noch.`;
    }

    for (const token of tokensByUser.get(uid) ?? []) {
      messages.push({
        to: token,
        title: "Streak in Gefahr",
        body,
        data: { type: "streak_reminder" },
        sound: "default",
        channelId: "streak-alerts",
      });
    }
  }

  await sendExpoPushNotification(messages);
  return { sent: messages.length };
}
