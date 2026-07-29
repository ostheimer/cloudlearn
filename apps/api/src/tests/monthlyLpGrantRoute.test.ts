/**
 * Route-level tests for /api/v1/lp/monthly-grant (#604).
 *
 * The monthly cron that delivers the promised 300 LP/month to active
 * Pro/Lifetime subscribers — annual subs renew only once a YEAR and lifetime
 * never, so without this cron they miss most or all monthly allotments.
 * The guard contract is identical to push/streak-alerts: unset secret → 503
 * in every environment, wrong or missing secret → 401, timing-safe compare.
 * GET is the Vercel-Cron trigger (Authorization: Bearer), POST the manual one
 * (x-cron-secret).
 *
 * `@/lib/http` is mocked with light Response-shaped fakes so the test never
 * has to load `next/server`.
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
const envState = vi.hoisted(() => ({ secret: "cron-secret" as string | undefined }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ CRON_SECRET: envState.secret }) }));
vi.mock("@/services/lpService", () => ({
  currentLpGrantPeriod: vi.fn(() => "2026-07"),
  grantMonthlyLpToActiveSubscribers: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({
  createRequestContext: () => ({ requestId: "req-cron-lp-1" }),
}));

import { GET, POST } from "../../app/api/v1/lp/monthly-grant/route";
import { grantMonthlyLpToActiveSubscribers } from "@/services/lpService";

const mockedSweep = vi.mocked(grantMonthlyLpToActiveSubscribers);

function cronRequest(secret?: string) {
  return new Request("http://localhost/api/v1/lp/monthly-grant", {
    method: "POST",
    headers: secret === undefined ? {} : { "x-cron-secret": secret },
  }) as never;
}

// Vercel Cron hits the endpoint with a GET and an `Authorization: Bearer …`.
function cronGetRequest(bearer?: string) {
  return new Request("http://localhost/api/v1/lp/monthly-grant", {
    method: "GET",
    headers: bearer === undefined ? {} : { authorization: bearer },
  }) as never;
}

describe("POST /api/v1/lp/monthly-grant – manual trigger (x-cron-secret)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSweep.mockResolvedValue({ eligible: 2, granted: 1, failed: 0 });
    envState.secret = "cron-secret";
  });

  it("runs the sweep for the current calendar month with the correct secret", async () => {
    const response = await POST(cronRequest("cron-secret"));
    const body = (await response.json()) as { period: string; granted: number };

    expect(response.status).toBe(200);
    expect(body).toEqual({ period: "2026-07", eligible: 2, granted: 1, failed: 0 });
    expect(mockedSweep).toHaveBeenCalledWith("2026-07");
  });

  it("returns 503 CRON_NOT_CONFIGURED when the secret is unset — no development bypass", async () => {
    envState.secret = undefined;

    const response = await POST(cronRequest("anything"));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(503);
    expect(body.code).toBe("CRON_NOT_CONFIGURED");
    expect(mockedSweep).not.toHaveBeenCalled();
  });

  it("returns 401 for a wrong secret", async () => {
    const response = await POST(cronRequest("wrong"));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(mockedSweep).not.toHaveBeenCalled();
  });

  it("returns 401 when the header is missing entirely", async () => {
    const response = await POST(cronRequest());

    expect(response.status).toBe(401);
    expect(mockedSweep).not.toHaveBeenCalled();
  });

  it("returns 500 without crediting further when the sweep itself throws", async () => {
    mockedSweep.mockRejectedValueOnce(new Error("db down"));

    const response = await POST(cronRequest("cron-secret"));

    expect(response.status).toBe(500);
  });
});

describe("GET /api/v1/lp/monthly-grant – Vercel Cron (Authorization: Bearer)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSweep.mockResolvedValue({ eligible: 3, granted: 3, failed: 0 });
    envState.secret = "cron-secret";
  });

  it("runs the sweep for the correct Bearer token (as Vercel Cron attaches)", async () => {
    const response = await GET(cronGetRequest("Bearer cron-secret"));
    const body = (await response.json()) as { granted: number };

    expect(response.status).toBe(200);
    expect(body.granted).toBe(3);
    expect(mockedSweep).toHaveBeenCalledWith("2026-07");
  });

  it("returns 401 for a wrong Bearer token", async () => {
    const response = await GET(cronGetRequest("Bearer nope"));

    expect(response.status).toBe(401);
    expect(mockedSweep).not.toHaveBeenCalled();
  });

  it("returns 401 without an Authorization header", async () => {
    const response = await GET(cronGetRequest());

    expect(response.status).toBe(401);
    expect(mockedSweep).not.toHaveBeenCalled();
  });

  it("returns 503 when the secret is unset", async () => {
    envState.secret = undefined;

    const response = await GET(cronGetRequest("Bearer cron-secret"));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(503);
    expect(body.code).toBe("CRON_NOT_CONFIGURED");
    expect(mockedSweep).not.toHaveBeenCalled();
  });
});
