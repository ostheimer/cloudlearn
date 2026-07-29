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
// The monthly grant (#604) runs through lpService.grantMonthlyLp with the
// calendar-month period key — the same key the /lp/monthly-grant cron uses.
vi.mock("@/services/lpService", () => ({
  grantLpPurchase: vi.fn(),
  grantMonthlyLp: vi.fn(),
  currentLpGrantPeriod: vi.fn(() => "2026-07"),
}));
vi.mock("@/services/subscriptionService", () => ({
  updateSubscriptionStatus: vi.fn(),
  transferSubscriptionBetweenUsers: vi.fn(),
}));
vi.mock("@/services/revenueCatService", () => ({ mapRevenueCatEventToSubscription: vi.fn() }));
vi.mock("@/lib/observability", () => ({ createRequestContext: () => ({ requestId: "req-wh-1" }) }));

import { POST } from "../../app/api/v1/subscription/webhook/route";
import { grantLpPurchase, grantMonthlyLp } from "@/services/lpService";
import { mapRevenueCatEventToSubscription } from "@/services/revenueCatService";
import {
  transferSubscriptionBetweenUsers,
  updateSubscriptionStatus,
} from "@/services/subscriptionService";

const mockedGrant = vi.mocked(grantLpPurchase);
const mockedMonthly = vi.mocked(grantMonthlyLp);
const mockedMap = vi.mocked(mapRevenueCatEventToSubscription);
const mockedUpdate = vi.mocked(updateSubscriptionStatus);
const mockedTransfer = vi.mocked(transferSubscriptionBetweenUsers);

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
    // An LP pack arrives as NON_RENEWING_PURCHASE too, but it must never ALSO
    // trigger the monthly subscription grant (#604) — the pack branch returns first.
    expect(mockedMonthly).not.toHaveBeenCalled();
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

describe("POST /api/v1/subscription/webhook – monthly Pro LP grant (#209 Part A, #604)", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    envState.secret = "secret";
    // Default: a plain subscription status update with no side effects.
    mockedUpdate.mockResolvedValue({ tier: "free", isActive: false } as never);
    mockedMap.mockReturnValue({ tier: "free", isActive: false, expiresAt: null });
    mockedMonthly.mockResolvedValue(true);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("grants monthly Pro LP on a RENEWAL, keyed to the calendar month", async () => {
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
    // Called with the auth-mapped user id (app_user_id), the resolved tier and the
    // CALENDAR month — NOT the expiry date, which paid annual subs once a year and
    // would collide with the /lp/monthly-grant cron (#604).
    expect(mockedMonthly).toHaveBeenCalledWith("user-42", "pro", "2026-07");
  });

  it("grants on a lifetime purchase (NON_RENEWING_PURCHASE, no expiry) (#604)", async () => {
    mockedMap.mockReturnValue({ tier: "lifetime", isActive: true, expiresAt: null });

    const response = await POST(
      webhookRequest({
        app_user_id: "user-42",
        type: "NON_RENEWING_PURCHASE",
        product_id: "clearn_lifetime",
        entitlement_ids: ["lifetime"],
      })
    );

    expect(response.status).toBe(201);
    // Not an LP pack, so the purchase falls through to the subscription path and
    // receives the instant month allotment; the cron covers every later month.
    expect(mockedGrant).not.toHaveBeenCalled();
    expect(mockedMonthly).toHaveBeenCalledWith("user-42", "lifetime", "2026-07");
  });

  it("does not grant monthly LP for a free / inactive subscription event", async () => {
    mockedMap.mockReturnValue({ tier: "free", isActive: false, expiresAt: null });

    const response = await POST(
      webhookRequest({ app_user_id: "user-42", type: "RENEWAL" })
    );

    expect(response.status).toBe(201);
    expect(mockedMonthly).not.toHaveBeenCalled();
  });

  it("does not grant on non-billing-period events even for an active Pro sub", async () => {
    // Active Pro, but a CANCELLATION opens no new period → no allotment is due.
    mockedMap.mockReturnValue({ tier: "pro", isActive: true, expiresAt: "2026-08-13T00:00:00.000Z" });

    const response = await POST(
      webhookRequest({ app_user_id: "user-42", type: "CANCELLATION", entitlement_ids: ["pro"] })
    );

    expect(response.status).toBe(201);
    expect(mockedMonthly).not.toHaveBeenCalled();
  });

  it("routes a TRANSFER event (no app_user_id) to the transfer handler (#607)", async () => {
    mockedTransfer.mockResolvedValueOnce({ movedTier: "pro" });

    const response = await POST(
      webhookRequest({
        type: "TRANSFER",
        transferred_from: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
        transferred_to: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
      })
    );
    const body = (await response.json()) as { type: string; movedTier: string };

    expect(response.status).toBe(201);
    expect(body.type).toBe("transfer_processed");
    expect(body.movedTier).toBe("pro");
    expect(mockedTransfer).toHaveBeenCalledWith(
      ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
      ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]
    );
    // Der Übertrag läuft NICHT durch den normalen Abo-Pfad.
    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(mockedMonthly).not.toHaveBeenCalled();
  });

  it("rejects a non-transfer event without app_user_id with 400", async () => {
    const response = await POST(webhookRequest({ type: "RENEWAL" }));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("still succeeds (2xx) when the monthly grant fails", async () => {
    mockedMap.mockReturnValue({ tier: "pro", isActive: true, expiresAt: "2026-08-13T00:00:00.000Z" });
    mockedMonthly.mockRejectedValueOnce(new Error("boom"));

    const response = await POST(
      webhookRequest({ app_user_id: "user-42", type: "RENEWAL", entitlement_ids: ["pro"] })
    );

    // The tier update already stuck; a failed additive grant must not fail the webhook.
    expect(response.status).toBe(201);
    expect(mockedMonthly).toHaveBeenCalled();
  });
});
