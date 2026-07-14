/**
 * Unit tests for the bundled evening streak reminder (Etappe 4): at most one
 * message per user, covering their own personal streak plus any shared friend
 * streak they still owe today. The Expo HTTP call is stubbed so nothing goes
 * out; we assert on the message bodies that would be sent.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendStreakAlertNotifications } from "@/services/notificationService";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { todayLocal } from "@/lib/localDay";

vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));

const today = todayLocal();
const PAST = "2020-01-01";
const U = "user-me";
const P = "user-partner";

function chain(result: unknown) {
  const obj: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "or"]) obj[m] = () => obj;
  obj.then = (onF: (v: unknown) => unknown) => Promise.resolve(result).then(onF);
  return obj;
}

function mockDb(opts: { tokens?: unknown[]; fsRows?: unknown[]; profs?: unknown[] }) {
  const from = vi.fn((table: string) => {
    if (table === "push_tokens") return chain({ data: opts.tokens ?? [] });
    if (table === "friend_streaks") return chain({ data: opts.fsRows ?? [] });
    if (table === "profiles") return chain({ data: opts.profs ?? [] });
    return chain({ data: [] });
  });
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ from } as never);
}

let fetchMock: ReturnType<typeof vi.fn>;
function sentBodies(): string[] {
  return fetchMock.mock.calls
    .flatMap((c) => JSON.parse((c[1] as { body: string }).body) as Array<{ body: string }>)
    .map((m) => m.body);
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ data: [] }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("sendStreakAlertNotifications — one bundled reminder per user", () => {
  it("personal streak at risk only → one 'your streak is waiting' message", async () => {
    mockDb({
      tokens: [{ user_id: U, token: "T1" }],
      fsRows: [],
      profs: [{ id: U, current_streak: 5, last_review_date: PAST, display_name: "Ich" }],
    });
    const res = await sendStreakAlertNotifications();
    expect(res.sent).toBe(1);
    expect(sentBodies()).toEqual(["Dein 5-Tage-Streak wartet. Lern heute, um ihn zu halten."]);
  });

  it("only a shared streak at risk → names the partner", async () => {
    mockDb({
      tokens: [{ user_id: U, token: "T1" }],
      // I owe today (my last_day is past), partner already did today, streak alive.
      fsRows: [{ user_low: U, user_high: P, last_day_low: PAST, last_day_high: today, current_streak: 3 }],
      profs: [
        { id: U, current_streak: 0, last_review_date: today, display_name: "Ich" },
        { id: P, current_streak: 3, last_review_date: today, display_name: "Lena" },
      ],
    });
    const res = await sendStreakAlertNotifications();
    expect(res.sent).toBe(1);
    expect(sentBodies()).toEqual(["Eure gemeinsame Flamme mit Lena braucht dich heute noch."]);
  });

  it("personal + shared at risk → a single bundled count message", async () => {
    mockDb({
      tokens: [{ user_id: U, token: "T1" }],
      fsRows: [{ user_low: U, user_high: P, last_day_low: PAST, last_day_high: today, current_streak: 3 }],
      profs: [
        { id: U, current_streak: 5, last_review_date: PAST, display_name: "Ich" },
        { id: P, current_streak: 3, last_review_date: today, display_name: "Lena" },
      ],
    });
    const res = await sendStreakAlertNotifications();
    expect(res.sent).toBe(1);
    expect(sentBodies()).toEqual(["2 deiner Streaks sind heute in Gefahr. Lern jetzt, um sie zu halten."]);
  });

  it("nothing at risk (already learned today) → no message", async () => {
    mockDb({
      tokens: [{ user_id: U, token: "T1" }],
      fsRows: [],
      profs: [{ id: U, current_streak: 5, last_review_date: today, display_name: "Ich" }],
    });
    const res = await sendStreakAlertNotifications();
    expect(res.sent).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a shared streak I already did today is not counted", async () => {
    mockDb({
      tokens: [{ user_id: U, token: "T1" }],
      fsRows: [{ user_low: U, user_high: P, last_day_low: today, last_day_high: PAST, current_streak: 3 }],
      profs: [
        { id: U, current_streak: 0, last_review_date: today, display_name: "Ich" },
        { id: P, current_streak: 3, last_review_date: PAST, display_name: "Lena" },
      ],
    });
    const res = await sendStreakAlertNotifications();
    expect(res.sent).toBe(0);
  });
});
