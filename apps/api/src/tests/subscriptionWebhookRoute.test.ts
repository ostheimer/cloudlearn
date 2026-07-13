/**
 * Route-level test for POST /api/v1/subscription/webhook (LP-pack path).
 *
 * After the #133 part 2 change the route no longer does a check-then-act
 * (isLpTransactionProcessed) before crediting — idempotency now lives in the DB
 * (grant_lp_purchase + partial unique index). This test pins the wiring: a
 * purchase event credits directly, with the transaction-derived reason.
 *
 * `@/lib/http` and `@/lib/contracts` are mocked so the test doesn't need
 * next/server or a live zod parse.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/http", () => ({
  jsonOk: (_requestId: string, data: unknown, status = 200) => ({ status, json: async () => data }),
  jsonError: (requestId: string, code: string, message: string, status = 400) => ({
    status,
    json: async () => ({ code, message, request_id: requestId }),
  }),
  normalizeError: (e: unknown) => ({
    code: "INTERNAL_ERROR",
    message: e instanceof Error ? e.message : "Unknown error",
    status: 500,
  }),
}));
vi.mock("@/lib/contracts", () => ({ revenueCatWebhookSchema: { parse: (x: unknown) => x } }));
// Configurable so individual tests can simulate a missing secret (#205: the
// secret is now required in EVERY environment, not just production).
const envState = vi.hoisted(() => ({ secret: "secret" as string | undefined }));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({ REVENUECAT_WEBHOOK_SECRET: envState.secret }),
}));
vi.mock("@/services/lpService", () => ({ grantLpPurchase: vi.fn() }));
vi.mock("@/services/subscriptionService", () => ({ updateSubscriptionStatus: vi.fn() }));
vi.mock("@/services/revenueCatService", () => ({ mapRevenueCatEventToSubscription: vi.fn() }));
vi.mock("@/lib/observability", () => ({ createRequestContext: () => ({ requestId: "req-wh-1" }) }));
// Admin Supabase client used only for the additive monthly-LP grant (#209 Part A).
const rpcMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: () => ({ rpc: rpcMock }) }));

import { POST } from "../../app/api/v1/subscription/webhook/route";
import { grantLpPurchase } from "@/services/lpService";
import { mapRevenueCatEventToSubscription } from "@/services/revenueCatService";
import { updateSubscriptionStatus } from "@/services/subscriptionService";

const mockedGrant = vi.mocked(grantLpPurchase);
const mockedMap = vi.mocked(mapRevenueCatEventToSubscription);
const mockedUpdate = vi.mocked(updateSubscriptionStatus);

function webhookRequest(event: Record<string, unknown>, signature = "secret") {
  return new Request("http://localhost/api/v1/subscription/webhook", {
    method: "POST",
    headers: { "x-revenuecat-signature": signature, "content-type": "application/json" },
    body: JSON.stringify({ event }),
  }) as never;
}

describe("POST /api/v1/subscription/webhook – LP pack idempotent grant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.secret = "secret";
  });

  it("credits an LP pack directly on a purchase event (reason derived from txid)", async () => {
    const response = await POST(
      webhookRequest({
        app_user_id: "user-9",
        type: "NON_RENEWING_PURCHASE",
        product_id: "lp_pack_300",
        transaction_id: "tx-123",
      })
    );
    const body = (await response.json()) as { type: string };

    expect(response.status).toBe(201);
    expect(body.type).toBe("lp_pack_granted");
    // grant_lp_purchase (via grantLpPurchase) is the single idempotent path — no
    // prior isLpTransactionProcessed SELECT, and the reason keys off the txid.
    expect(mockedGrant).toHaveBeenCalledWith("user-9", 300, "purchase_tx-123");
  });

  it("rejects an invalid signature before crediting anything", async () => {
    const response = await POST(
      webhookRequest(
        { app_user_id: "user-9", type: "NON_RENEWING_PURCHASE", product_id: "lp_pack_300", transaction_id: "tx-123" },
        "wrong-secret"
      )
    );

    expect(response.status).toBe(401);
    expect(mockedGrant).not.toHaveBeenCalled();
  });

  it("returns 503 WEBHOOK_NOT_CONFIGURED when no secret is configured — in every environment (#205)", async () => {
    envState.secret = undefined;

    const response = await POST(
      webhookRequest({
        app_user_id: "user-9",
        type: "NON_RENEWING_PURCHASE",
        product_id: "lp_pack_300",
        transaction_id: "tx-123",
      })
    );
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(503);
    expect(body.code).toBe("WEBHOOK_NOT_CONFIGURED");
    expect(mockedGrant).not.toHaveBeenCalled();
  });

  it("rejects a missing signature header with 401", async () => {
    const request = new Request("http://localhost/api/v1/subscription/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: { app_user_id: "user-9", type: "NON_RENEWING_PURCHASE", product_id: "lp_pack_300", transaction_id: "tx-123" },
      }),
    }) as never;

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mockedGrant).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/subscription/webhook – monthly Pro LP grant (#209 Part A)", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    envState.secret = "secret";
    // Default: a plain subscription status update with no side effects.
    mockedUpdate.mockResolvedValue({ tier: "free", isActive: false } as never);
    mockedMap.mockReturnValue({ tier: "free", isActive: false, expiresAt: null });
    rpcMock.mockResolvedValue({ error: null });
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("grants monthly Pro LP on a RENEWAL, keyed to the billing-period expiry date", async () => {
    mockedMap.mockReturnValue({ tier: "pro", isActive: true, expiresAt: "2026-08-13T00:00:00.000Z" });

    const response = await POST(
      webhookRequest({
        app_user_id: "user-42",
        type: "RENEWAL",
        entitlement_ids: ["pro"],
        expiration_at_ms: 1_755_043_200_000,
      })
    );

    expect(response.status).toBe(201);
    // Called with the auth-mapped user id (app_user_id), tier 'pro', the 300-LP Pro
    // allotment, and a per-period key derived from the expiry date (YYYY-MM-DD).
    expect(rpcMock).toHaveBeenCalledWith("grant_monthly_lp", {
      p_user: "user-42",
      p_tier: "pro",
      p_amount: 300,
      p_period: "2026-08-13",
    });
  });

  it("does not grant monthly LP for a free / inactive subscription event", async () => {
    mockedMap.mockReturnValue({ tier: "free", isActive: false, expiresAt: null });

    const response = await POST(
      webhookRequest({ app_user_id: "user-42", type: "RENEWAL" })
    );

    expect(response.status).toBe(201);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("does not grant on non-billing-period events even for an active Pro sub", async () => {
    // Active Pro, but a CANCELLATION opens no new period → no allotment is due.
    mockedMap.mockReturnValue({ tier: "pro", isActive: true, expiresAt: "2026-08-13T00:00:00.000Z" });

    const response = await POST(
      webhookRequest({ app_user_id: "user-42", type: "CANCELLATION", entitlement_ids: ["pro"] })
    );

    expect(response.status).toBe(201);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("still succeeds (2xx) when the monthly-grant RPC returns an error", async () => {
    mockedMap.mockReturnValue({ tier: "pro", isActive: true, expiresAt: "2026-08-13T00:00:00.000Z" });
    rpcMock.mockResolvedValueOnce({ error: { message: "boom" } });

    const response = await POST(
      webhookRequest({ app_user_id: "user-42", type: "RENEWAL", entitlement_ids: ["pro"] })
    );

    // The tier update already stuck; a failed additive grant must not fail the webhook.
    expect(response.status).toBe(201);
    expect(rpcMock).toHaveBeenCalled();
  });
});
