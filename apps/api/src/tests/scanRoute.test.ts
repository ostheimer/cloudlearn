/**
 * Route-level tests for POST /api/v1/scan/process.
 *
 * Same fairness fix as the PDF route: LP are charged up front, and if
 * processScan throws (notably the image path, which has no heuristic fallback)
 * the route must refund the LP before re-throwing the original error.
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
  normalizeError: (error: unknown) => {
    const e = error as { status?: unknown; code?: unknown; message?: string };
    if (typeof e?.status === "number") {
      return {
        code: typeof e.code === "string" ? e.code : "REQUEST_ERROR",
        message: e.message ?? "",
        status: e.status,
      };
    }
    return {
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Unknown error",
      status: 500,
    };
  },
}));

vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    RATE_LIMIT_FREE_PER_MINUTE: 20,
    RATE_LIMIT_PRO_PER_MINUTE: 60,
    FREE_SCAN_LIMIT_PER_MONTH: 30,
  }),
}));
vi.mock("@/services/subscriptionService", () => ({ getSubscriptionStatus: vi.fn() }));
vi.mock("@/services/lpService", () => ({ spendLp: vi.fn() }));
vi.mock("@/lib/lpRefund", () => ({ refundOnFailure: vi.fn() }));
vi.mock("@/services/scanService", () => ({ processScan: vi.fn() }));
vi.mock("@/lib/observability", () => ({
  createRequestContext: () => ({ requestId: "req-scan-1" }),
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

import { POST } from "../../app/api/v1/scan/process/route";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import { spendLp } from "@/services/lpService";
import { refundOnFailure } from "@/lib/lpRefund";
import { processScan } from "@/services/scanService";

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetSubscription = vi.mocked(getSubscriptionStatus);
const mockedSpendLp = vi.mocked(spendLp);
const mockedRefundOnFailure = vi.mocked(refundOnFailure);
const mockedProcessScan = vi.mocked(processScan);

const USER_ID = "22222222-2222-4222-8222-222222222222";

function makeRequest() {
  return new Request("http://localhost/api/v1/scan/process", {
    method: "POST",
    body: JSON.stringify({ imageBase64: "AAA", idempotencyKey: "k1" }),
    headers: { "content-type": "application/json" },
  }) as never;
}

const okResult = {
  requestId: "req-scan-1",
  model: "gemini-2.5",
  fallbackUsed: false,
  cards: [{ front: "q", back: "a" }],
  deckTitle: "Scan",
};

describe("POST /api/v1/scan/process – LP refund on failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockResolvedValue({ userId: USER_ID, email: "lara@example.com" });
    mockedCheckRateLimit.mockResolvedValue(true);
    mockedGetSubscription.mockResolvedValue({ tier: "free" } as never);
  });

  it("does NOT refund on success", async () => {
    mockedSpendLp.mockResolvedValue({ allowed: true, newBalance: 90, cost: 10 });
    mockedProcessScan.mockResolvedValue(okResult as never);

    const response = await POST(makeRequest());
    const body = (await response.json()) as { usage: { lpSpent: number; lpBalance: number } };

    expect(response.status).toBe(200);
    expect(body.usage.lpSpent).toBe(10);
    expect(body.usage.lpBalance).toBe(90);
    expect(mockedRefundOnFailure).not.toHaveBeenCalled();
  });

  it("refunds the LP when the AI scan throws, and surfaces the original error", async () => {
    mockedSpendLp.mockResolvedValue({ allowed: true, newBalance: 90, cost: 10 });
    mockedProcessScan.mockRejectedValue(new Error("image model failed"));

    const response = await POST(makeRequest());
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(500);
    expect(body.message).toBe("image model failed");
    expect(mockedRefundOnFailure).toHaveBeenCalledWith(
      USER_ID,
      10,
      "refund_aiScan_failed",
      "req-scan-1"
    );
  });

  it("returns 402 and never charges/refunds when balance is insufficient", async () => {
    mockedSpendLp.mockResolvedValue({ allowed: false, newBalance: 3, cost: 10 });

    const response = await POST(makeRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(402);
    expect(body.code).toBe("INSUFFICIENT_LP");
    expect(mockedProcessScan).not.toHaveBeenCalled();
    expect(mockedRefundOnFailure).not.toHaveBeenCalled();
  });
});
