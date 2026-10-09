import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  balance: 10,
  sessionPaid: false,
  milestonePaid: false,
  readFailure: "" as "" | "missing" | "database",
  reads: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getAuthUser: async () => ({ userId: "user" }) }));
vi.mock("@/services/subscriptionService", () => ({ getSubscriptionStatus: async () => ({ tier: "free" }) }));
vi.mock("@/lib/db", () => ({
  hasAnyReviewLog: async () => true,
  getStreakInfo: async () => ({ currentStreak: 0 }),
}));
vi.mock("@/lib/supabase", () => ({
  createSupabaseAdminClient: () => ({
    rpc: state.rpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: state.reads }) }) }),
  }),
}));

import { POST } from "../../app/api/v1/lp/earn/route";
import { getLpProfile } from "@/services/lpService";

const post = () => POST(new Request("http://localhost/api/v1/lp/earn", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ type: "session" }),
}) as never);

beforeEach(() => {
  vi.clearAllMocks();
  state.balance = 10;
  state.sessionPaid = false;
  state.milestonePaid = false;
  state.readFailure = "";
  // The SQL watermark/unique claim prevent repeat credits. The real SQL replay
  // is checked separately in lpDb.integration.test.ts; this fixture tests HTTP.
  state.rpc.mockImplementation(async (name: string) => {
    if (name === "earn_session_lp") {
      const granted = state.sessionPaid ? 0 : 8;
      state.sessionPaid = true;
      state.balance += granted;
      return { data: [{ granted, new_balance: state.balance, cap_reached: false }], error: null };
    }
    const granted = state.milestonePaid ? 0 : 5;
    state.milestonePaid = true;
    state.balance += granted;
    return { data: [{ granted, already_claimed: granted === 0, new_balance: state.balance }], error: null };
  });
  state.reads.mockImplementation(async () => {
    if (state.readFailure === "database") return { data: null, error: { message: "private database detail" } };
    if (state.readFailure === "missing") return { data: null, error: null };
    return { data: { lp_balance: state.balance }, error: null };
  });
});

describe("POST /lp/earn with real LP service readback (#702)", () => {
  it.each(["missing", "database"] as const)("does not return a fabricated balance after %s readback", async (failure) => {
    state.readFailure = failure;
    const response = await post();
    expect(state.balance).toBe(23); // Both credits were already committed.
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ code: "LP_BALANCE_UNAVAILABLE" });
    expect(body).not.toHaveProperty("newBalance");
    expect(JSON.stringify(body)).not.toContain("private database detail");
  });

  it("retries after failed readback without re-paying reviews or milestones", async () => {
    state.readFailure = "database";
    expect((await post()).status).toBe(503);
    state.readFailure = "";
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ granted: 0, newBalance: 23, milestones: [] });
    expect(state.balance).toBe(23);
    expect(state.reads).toHaveBeenCalledTimes(1); // No newly granted milestone on retry.
  });

  it("keeps the existing default semantics for other getLpProfile callers", async () => {
    state.readFailure = "missing";
    expect((await getLpProfile("user")).balance).toBe(10);
  });
});
