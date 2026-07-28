/**
 * Unit tests for the friend-streak push decisions (Etappe 2): who gets a push,
 * when, and with what message. The underlying SQL (invite/accept/progression)
 * is covered by the real-Postgres integration tests; here we pin the service
 * glue with a lightweight chainable Supabase mock.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  clampDisplayName,
  inviteFriendStreak,
  leaveFriendStreak,
  remindFriendStreak,
} from "@/services/friendStreakService";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { sendExpoPushNotification } from "@/services/notificationService";

vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/services/notificationService", () => ({ sendExpoPushNotification: vi.fn().mockResolvedValue([]) }));

// A query builder that is both chainable (.select().eq()…) and awaitable
// (resolves to `result`), plus .maybeSingle() → result.
function chain(result: unknown) {
  const obj: Record<string, unknown> = {};
  for (const m of ["select", "eq", "or", "delete"]) obj[m] = () => obj;
  obj.maybeSingle = () => Promise.resolve(result);
  obj.then = (onF: (v: unknown) => unknown) => Promise.resolve(result).then(onF);
  return obj;
}

/**
 * friend_push_log backs the push brake (#342): one row per (sender, recipient,
 * local day). The service claims a slot with an INSERT … ON CONFLICT DO NOTHING
 * (`.upsert(..., { ignoreDuplicates: true }).select()` → the inserted row, or []
 * on conflict) and then best-effort prunes older days of that direction with
 * `.delete().eq().eq().lt()`.
 *
 * The mock simulates both against an in-memory Set of "sender|recipient|day"
 * keys, shared across calls on one mockDb(), so a test can nudge twice and watch
 * the brake bite. Unlike the old brake this table stands on its own, so leaving
 * a streak (which deletes the friend_streaks row) never resets it.
 */
function friendPushLogTable(log: Set<string>) {
  const obj: Record<string, unknown> = {};
  let mode: "upsert" | "delete" | null = null;
  let payload: { sender_id: string; recipient_id: string; local_day: string } | null = null;
  const filters: { sender_id?: string; recipient_id?: string; ltDay?: string } = {};

  obj.upsert = (p: { sender_id: string; recipient_id: string; local_day: string }) => {
    mode = "upsert";
    payload = p;
    return obj;
  };
  obj.delete = () => {
    mode = "delete";
    return obj;
  };
  obj.select = () => obj;
  obj.eq = (col: string, val: string) => {
    (filters as Record<string, string>)[col] = val;
    return obj;
  };
  obj.lt = (_col: string, val: string) => {
    filters.ltDay = val;
    return obj;
  };

  function resolve() {
    if (mode === "upsert" && payload) {
      const key = `${payload.sender_id}|${payload.recipient_id}|${payload.local_day}`;
      if (log.has(key)) return { data: [] }; // conflict → nothing inserted
      log.add(key);
      return { data: [{ local_day: payload.local_day }] };
    }
    if (mode === "delete") {
      for (const key of [...log]) {
        const [s, r, d] = key.split("|");
        if (s === filters.sender_id && r === filters.recipient_id && filters.ltDay && d! < filters.ltDay) {
          log.delete(key);
        }
      }
      return { data: null };
    }
    return { data: null };
  }
  obj.then = (onF: (v: unknown) => unknown) => Promise.resolve(resolve()).then(onF);
  return obj;
}

function mockDb(opts: {
  rpcResult?: string;
  streakRow?: { status: string; invited_by: string } | null;
  tokens?: string[];
  name?: string | null;
  log?: Set<string>;
}) {
  const log: Set<string> = opts.log ?? new Set<string>();
  const rpc = vi.fn().mockResolvedValue({ data: opts.rpcResult ?? null, error: null });
  const from = vi.fn((table: string) => {
    if (table === "push_tokens") return chain({ data: (opts.tokens ?? []).map((t) => ({ token: t })) });
    if (table === "profiles") return chain({ data: { display_name: opts.name ?? null } });
    if (table === "friend_streaks") return chain({ data: opts.streakRow ?? null });
    if (table === "friend_push_log") return friendPushLogTable(log);
    return chain({ data: null });
  });
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ rpc, from } as never);
  return { rpc, from, log };
}

function pushBodies(): string[] {
  return vi.mocked(sendExpoPushNotification).mock.calls.map((c) => c[0][0]!.body as string);
}

const A = "user-a";
const B = "user-b";

describe("inviteFriendStreak — push on a fresh invite", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pushes the invitee when the invite is newly created", async () => {
    mockDb({ rpcResult: "invited", tokens: ["ExpoTok[B]"], name: "Lara" });
    const res = await inviteFriendStreak(A, B);

    expect(res.result).toBe("invited");
    expect(sendExpoPushNotification).toHaveBeenCalledTimes(1);
    const messages = vi.mocked(sendExpoPushNotification).mock.calls[0]![0];
    expect(messages[0]!.to).toBe("ExpoTok[B]");
    expect(messages[0]!.body).toContain("Lara");
    expect(messages[0]!.body).toContain("lädt dich");
    expect(messages[0]!.data).toMatchObject({ type: "friend_streak_invite" });
  });

  it("does not push when the pair was already invited (result: pending)", async () => {
    mockDb({ rpcResult: "pending", tokens: ["ExpoTok[B]"], name: "Lara" });
    const res = await inviteFriendStreak(A, B);

    expect(res.result).toBe("pending");
    expect(sendExpoPushNotification).not.toHaveBeenCalled();
  });

  it("does not push when they are not friends", async () => {
    mockDb({ rpcResult: "not_friends" });
    const res = await inviteFriendStreak(A, B);

    expect(res.result).toBe("not_friends");
    expect(sendExpoPushNotification).not.toHaveBeenCalled();
  });
});

describe("remindFriendStreak — active nudge vs. accept nudge", () => {
  beforeEach(() => vi.clearAllMocks());

  it("active streak → 'your turn' push", async () => {
    mockDb({ streakRow: { status: "active", invited_by: A }, tokens: ["ExpoTok[B]"], name: "Lara" });
    const res = await remindFriendStreak(A, B);

    expect(res.sent).toBe(true);
    const messages = vi.mocked(sendExpoPushNotification).mock.calls[0]![0];
    expect(messages[0]!.body).toContain("hat heute gelernt");
    expect(messages[0]!.data).toMatchObject({ type: "friend_streak_reminder" });
  });

  it("pending invite, sent by me → 'please accept' push", async () => {
    mockDb({ streakRow: { status: "pending", invited_by: A }, tokens: ["ExpoTok[B]"], name: "Lara" });
    const res = await remindFriendStreak(A, B);

    expect(res.sent).toBe(true);
    const messages = vi.mocked(sendExpoPushNotification).mock.calls[0]![0];
    expect(messages[0]!.body).toContain("annimmst");
    expect(messages[0]!.data).toMatchObject({ type: "friend_streak_invite" });
  });

  it("pending invite I did NOT send → no push (can't nudge myself to accept)", async () => {
    mockDb({ streakRow: { status: "pending", invited_by: B }, tokens: ["ExpoTok[B]"], name: "Lara" });
    const res = await remindFriendStreak(A, B);

    expect(res.sent).toBe(false);
    expect(sendExpoPushNotification).not.toHaveBeenCalled();
  });

  it("no pairing at all → no push", async () => {
    mockDb({ streakRow: null });
    const res = await remindFriendStreak(A, B);

    expect(res.sent).toBe(false);
    expect(sendExpoPushNotification).not.toHaveBeenCalled();
  });
});

/**
 * The push brake: one push per sender → recipient per local day. Without it any
 * friend can fire unlimited pushes carrying self-chosen display-name text.
 */
describe("push brake — max one push per pair per local day", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  it("a second remind on the same day sends nothing and reports sent:false", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T09:00:00Z"));
    mockDb({ streakRow: { status: "active", invited_by: A }, tokens: ["ExpoTok[B]"], name: "Lara" });

    const first = await remindFriendStreak(A, B);
    vi.setSystemTime(new Date("2026-07-16T18:30:00Z")); // same Berlin day
    const second = await remindFriendStreak(A, B);

    expect(first.sent).toBe(true);
    expect(second.sent).toBe(false);
    expect(sendExpoPushNotification).toHaveBeenCalledTimes(1);
  });

  it("the next day the reminder works again", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T09:00:00Z"));
    mockDb({ streakRow: { status: "active", invited_by: A }, tokens: ["ExpoTok[B]"], name: "Lara" });

    const first = await remindFriendStreak(A, B);
    vi.setSystemTime(new Date("2026-07-17T09:00:00Z"));
    const nextDay = await remindFriendStreak(A, B);

    expect(first.sent).toBe(true);
    expect(nextDay.sent).toBe(true);
    expect(sendExpoPushNotification).toHaveBeenCalledTimes(2);
  });

  it("invite then remind on the same day pushes only once (re-inviting can't bypass)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T09:00:00Z"));
    mockDb({
      rpcResult: "invited",
      streakRow: { status: "pending", invited_by: A },
      tokens: ["ExpoTok[B]"],
      name: "Lara",
    });

    await inviteFriendStreak(A, B);
    const reminded = await remindFriendStreak(A, B);

    expect(reminded.sent).toBe(false);
    expect(sendExpoPushNotification).toHaveBeenCalledTimes(1);
    expect(pushBodies()[0]).toContain("lädt dich"); // the invite push, not the nudge
  });

  it("the brake is per direction — B may still nudge A after A nudged B", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T09:00:00Z"));
    mockDb({ streakRow: { status: "active", invited_by: A }, tokens: ["ExpoTok[X]"], name: "Lara" });

    const aToB = await remindFriendStreak(A, B);
    const bToA = await remindFriendStreak(B, A);

    expect(aToB.sent).toBe(true);
    expect(bToA.sent).toBe(true);
    expect(sendExpoPushNotification).toHaveBeenCalledTimes(2);
  });

  it("an ineligible nudge does not burn the day's slot", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T09:00:00Z"));
    // Pending invite sent by B: A may not nudge…
    const db = mockDb({
      streakRow: { status: "pending", invited_by: B },
      tokens: ["ExpoTok[B]"],
      name: "Lara",
    });

    const blocked = await remindFriendStreak(A, B);

    expect(blocked.sent).toBe(false);
    expect(db.log.size).toBe(0); // …and nothing was logged
  });

  it("leaving and re-inviting the same day does not hand out a fresh slot (#342)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T09:00:00Z"));
    mockDb({ rpcResult: "invited", tokens: ["ExpoTok[B]"], name: "Lara" });

    await inviteFriendStreak(A, B); // claims today's slot and pushes once
    await leaveFriendStreak(A, B); // deletes the friend_streaks row — brake must NOT reset
    await inviteFriendStreak(A, B); // same Berlin day, fresh streak row

    // The brake lives in friend_push_log, not on the deleted streak row, so the
    // re-invite finds today's slot already taken and stays silent.
    expect(sendExpoPushNotification).toHaveBeenCalledTimes(1);
  });
});

describe("clampDisplayName — display_name is unvalidated client text", () => {
  it("keeps a normal name unchanged", () => {
    expect(clampDisplayName("Lara", "Fallback")).toBe("Lara");
  });

  it("falls back for empty, whitespace-only and non-string values", () => {
    expect(clampDisplayName("   ", "Fallback")).toBe("Fallback");
    expect(clampDisplayName(null, "Fallback")).toBe("Fallback");
    expect(clampDisplayName(undefined, "Fallback")).toBe("Fallback");
    expect(clampDisplayName(42, "Fallback")).toBe("Fallback");
  });

  it("strips newlines and control characters so a name can't fake push lines", () => {
    const clamped = clampDisplayName("Lara\n\nGratis LP\rhier", "Fallback");
    expect(clamped).toBe("Lara Gratis LP hier");
    expect(clamped).not.toMatch(/[\n\r]/);
  });

  it("strips zero-width and bidi-override spoofing characters", () => {
    expect(clampDisplayName("La​ra‮", "Fallback")).toBe("La ra");
  });

  it("truncates to 40 characters including the ellipsis", () => {
    const clamped = clampDisplayName("A".repeat(80), "Fallback");
    expect(clamped).toHaveLength(40);
    expect(clamped.endsWith("…")).toBe(true);
    expect(clamped).toBe(`${"A".repeat(39)}…`);
  });

  it("leaves a name of exactly 40 characters alone", () => {
    const exact = "B".repeat(40);
    expect(clampDisplayName(exact, "Fallback")).toBe(exact);
  });
});

describe("push body uses the clamped name", () => {
  beforeEach(() => vi.clearAllMocks());

  it("an overlong, newline-laden display name is truncated and sanitised", async () => {
    const evil = "  Lara\nGRATIS LP: klick evil.example jetzt sofort und hol dir alles ab!  ";
    mockDb({ streakRow: { status: "active", invited_by: A }, tokens: ["ExpoTok[B]"], name: evil });

    const res = await remindFriendStreak(A, B);
    const body = pushBodies()[0]!;
    const suffix = " hat heute gelernt. Lern auch du, damit eure Flamme weiterbrennt!";

    expect(res.sent).toBe(true);
    expect(body).not.toMatch(/[\n\r]/);
    expect(body).toContain("Lara GRATIS LP");
    expect(body).not.toContain("hol dir alles ab"); // tail cut off
    expect(body).toBe(`Lara GRATIS LP: klick evil.example jetz…${suffix}`);
    // The interpolated name is clamped to 40 chars; the rest is our own text.
    expect(body).toHaveLength(40 + suffix.length);
  });
});
