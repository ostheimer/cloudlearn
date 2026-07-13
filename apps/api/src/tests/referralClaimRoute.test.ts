/**
 * Route-level tests for POST /api/v1/referral/claim (#203).
 *
 * The route used to do a non-atomic read-modify-write across four round-trips
 * with only a self-referral check and NO cap — farmable and race-prone. It now
 * delegates the entire claim to the atomic `claim_referral` RPC. These tests
 * pin down that:
 *   * the amounts and the claimer identity are server-controlled (taken from the
 *     auth token + LP_EARN_RULES + REFERRAL_SENDER_CAP, never the client body);
 *   * every RPC status maps to the correct HTTP contract;
 *   * an RPC error is normalised rather than leaking a 200.
 *
 * `@/lib/http` is mocked with light Response-shaped fakes so the test never has
 * to load `next/server`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/http", () => ({
  jsonOk: (_requestId: string, data: unknown, status = 200) => ({
    status,
    json: async () => data,
  }),
  jsonError: (requestId: string, code: string, message: string, status = 400) => ({
    status,
    json: async () => ({ code, message, request_id: requestId }),
  }),
  normalizeError: (error: unknown) => ({
    code: "INTERNAL_ERROR",
    message: error instanceof Error ? error.message : "Unknown error",
    status: 500,
  }),
}));
vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/observability", () => ({
  createRequestContext: () => ({ requestId: "req-referral-1" }),
}));

import { POST } from "../../app/api/v1/referral/claim/route";
import { getAuthUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { LP_EARN_RULES, REFERRAL_SENDER_CAP } from "@/lib/featureGates";

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedCreateDb = vi.mocked(createSupabaseAdminClient);

const AUTH_USER_ID = "11111111-1111-4111-8111-111111111111";
const VALID_CODE = "FRIEND42";

function makeRequest(body: Record<string, unknown> = { code: VALID_CODE }) {
  return new Request("http://localhost/api/v1/referral/claim", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }) as never;
}

function makeDbMock(rpcResult: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  return { db: { rpc } as never, rpc };
}

describe("POST /api/v1/referral/claim – atomic claim + per-referrer cap (#203)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockResolvedValue({ userId: AUTH_USER_ID, email: "lara@example.com" });
  });

  it("returns 401 UNAUTHORIZED without a valid token and never touches the database", async () => {
    mockedGetAuthUser.mockResolvedValue(null);

    const response = await POST(makeRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(mockedCreateDb).not.toHaveBeenCalled();
  });

  it("calls the RPC with the auth user id + server-controlled amounts and cap", async () => {
    const { db, rpc } = makeDbMock({
      data: { status: "ok", claimerBonus: 25, referrerBonus: 50, referrerCapped: false, newBalance: 125 },
      error: null,
    });
    mockedCreateDb.mockReturnValue(db);

    // A userId smuggled into the body must be ignored — identity comes from auth.
    await POST(makeRequest({ code: VALID_CODE, claimerId: "99999999-9999-4999-8999-999999999999" }));

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("claim_referral", {
      p_claimer: AUTH_USER_ID,
      p_code: VALID_CODE,
      p_referrer_bonus: LP_EARN_RULES.referralSender,
      p_claimer_bonus: LP_EARN_RULES.referralReceiver,
      p_referrer_cap: REFERRAL_SENDER_CAP,
    });
  });

  it("returns 200 with lpGranted + newBalance + referrerCapped from the RPC", async () => {
    const { db } = makeDbMock({
      data: { status: "ok", claimerBonus: 25, referrerBonus: 50, referrerCapped: false, newBalance: 125 },
      error: null,
    });
    mockedCreateDb.mockReturnValue(db);

    const response = await POST(makeRequest());
    const body = (await response.json()) as {
      success: boolean;
      lpGranted: number;
      newBalance: number;
      referrerCapped: boolean;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.lpGranted).toBe(25);
    expect(body.newBalance).toBe(125);
    expect(body.referrerCapped).toBe(false);
  });

  it("surfaces referrerCapped=true once the referrer hits the cap (claimer still paid)", async () => {
    const { db } = makeDbMock({
      data: { status: "ok", claimerBonus: 25, referrerBonus: 0, referrerCapped: true, newBalance: 200 },
      error: null,
    });
    mockedCreateDb.mockReturnValue(db);

    const response = await POST(makeRequest());
    const body = (await response.json()) as { lpGranted: number; referrerCapped: boolean };

    expect(response.status).toBe(200);
    expect(body.lpGranted).toBe(25);
    expect(body.referrerCapped).toBe(true);
  });

  it("maps status 'already_referred' → 409 ALREADY_REFERRED", async () => {
    const { db } = makeDbMock({ data: { status: "already_referred" }, error: null });
    mockedCreateDb.mockReturnValue(db);

    const response = await POST(makeRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(409);
    expect(body.code).toBe("ALREADY_REFERRED");
  });

  it("maps status 'code_not_found' → 404 CODE_NOT_FOUND", async () => {
    const { db } = makeDbMock({ data: { status: "code_not_found" }, error: null });
    mockedCreateDb.mockReturnValue(db);

    const response = await POST(makeRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(404);
    expect(body.code).toBe("CODE_NOT_FOUND");
  });

  it("maps status 'self' → 400 SELF_REFERRAL", async () => {
    const { db } = makeDbMock({ data: { status: "self" }, error: null });
    mockedCreateDb.mockReturnValue(db);

    const response = await POST(makeRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe("SELF_REFERRAL");
  });

  it("maps status 'claimer_not_found' → 404 PROFILE_NOT_FOUND", async () => {
    const { db } = makeDbMock({ data: { status: "claimer_not_found" }, error: null });
    mockedCreateDb.mockReturnValue(db);

    const response = await POST(makeRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(404);
    expect(body.code).toBe("PROFILE_NOT_FOUND");
  });

  it("normalises an RPC error instead of returning a success", async () => {
    const { db } = makeDbMock({ data: null, error: { message: "deadlock detected" } });
    mockedCreateDb.mockReturnValue(db);

    const response = await POST(makeRequest());
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.message).toBe("deadlock detected");
  });

  it("rejects a malformed code with 400 INVALID_CODE before touching the database", async () => {
    const response = await POST(makeRequest({ code: "x" }));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_CODE");
    expect(mockedCreateDb).not.toHaveBeenCalled();
  });
});
