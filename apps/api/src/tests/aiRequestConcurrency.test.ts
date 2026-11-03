import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ claimed: false, fail: false, response: null as unknown }));
vi.mock("@/lib/idempotencyStore", async (original) => ({ ...await original<typeof import("@/lib/idempotencyStore")>(), getIdempotentResult: vi.fn(async () => null) }));
vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: () => ({ rpc: vi.fn(async (name, args) => {
  if (state.fail) return { data: null, error: { message: "offline" } };
  if (name === "claim_ai_request") {
    if (state.response) return { data: { status: "complete", response: state.response }, error: null };
    if (state.claimed) return { data: { status: "in_progress" }, error: null };
    state.claimed = true;
    return { data: { status: "claimed" }, error: null };
  }
  if (name === "complete_ai_request") state.response = args.p_response;
  if (name === "release_ai_request") state.claimed = false;
  return { data: true, error: null };
}) }) }));
vi.mock("@/services/lpService", () => ({ spendLp: vi.fn(async () => ({ allowed: true, cost: 10, newBalance: 90 })), getLpProfile: vi.fn(async () => ({ balance: 90 })) }));
vi.mock("@/lib/lpRefund", () => ({ refundOnFailure: vi.fn(async () => {}) }));
import { runLpChargedIdempotentRequest } from "@/lib/lpChargedIdempotentRequest";
import { spendLp } from "@/services/lpService";
const params = { idempotencyKey: "same-request", userId: "user-1", plan: "free" as const, feature: "aiScan" as const, requestId: "req-1", refundReason: "refund" };
beforeEach(() => { state.claimed = false; state.fail = false; state.response = null; vi.clearAllMocks(); });
describe("#756 concurrent jobs", () => {
  it("claims before LP and runs just one simultaneous job", async () => {
    const process = vi.fn(async () => { await new Promise(r => setTimeout(r, 20)); return { cards: [] }; });
    const outcomes = await Promise.allSettled([runLpChargedIdempotentRequest({ ...params, process }), runLpChargedIdempotentRequest({ ...params, process })]);
    expect(process).toHaveBeenCalledTimes(1); expect(spendLp).toHaveBeenCalledTimes(1);
    expect(outcomes.filter(x => x.status === "rejected")).toHaveLength(1);
    const replay = await runLpChargedIdempotentRequest({ ...params, process });
    expect(replay).toMatchObject({ kind: "ok", usage: { lpSpent: 0 } }); expect(process).toHaveBeenCalledTimes(1);
  });
  it("fails before charging or generating when the claim store fails", async () => { state.fail = true; const process = vi.fn(); await expect(runLpChargedIdempotentRequest({ ...params, process })).rejects.toMatchObject({ code: "AI_REQUEST_UNAVAILABLE" }); expect(spendLp).not.toHaveBeenCalled(); expect(process).not.toHaveBeenCalled(); });
});
