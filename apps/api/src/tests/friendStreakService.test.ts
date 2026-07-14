/**
 * Unit tests for the friend-streak push decisions (Etappe 2): who gets a push,
 * when, and with what message. The underlying SQL (invite/accept/progression)
 * is covered by the real-Postgres integration tests; here we pin the service
 * glue with a lightweight chainable Supabase mock.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { inviteFriendStreak, remindFriendStreak } from "@/services/friendStreakService";
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

function mockDb(opts: {
  rpcResult?: string;
  streakRow?: { status: string; invited_by: string } | null;
  tokens?: string[];
  name?: string | null;
}) {
  const rpc = vi.fn().mockResolvedValue({ data: opts.rpcResult ?? null, error: null });
  const from = vi.fn((table: string) => {
    if (table === "push_tokens") return chain({ data: (opts.tokens ?? []).map((t) => ({ token: t })) });
    if (table === "profiles") return chain({ data: { display_name: opts.name ?? null } });
    if (table === "friend_streaks") return chain({ data: opts.streakRow ?? null });
    return chain({ data: null });
  });
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ rpc, from } as never);
  return { rpc, from };
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
