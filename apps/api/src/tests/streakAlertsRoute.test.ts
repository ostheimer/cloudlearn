/**
 * Route-level tests for POST /api/v1/push/streak-alerts (#205).
 *
 * The cron guard used to (a) let ANY caller through when CRON_SECRET was
 * unset, (b) skip the check entirely in development, and (c) compare with a
 * timing-unsafe `!==`. Now: unset secret → 503 in every environment, wrong or
 * missing `x-cron-secret` header → 401, comparison is timing-safe. The header
 * contract (`x-cron-secret`) is unchanged.
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
vi.mock("@/services/notificationService", () => ({
  sendStreakAlertNotifications: vi.fn().mockResolvedValue({ sent: 2 }),
}));
vi.mock("@/lib/observability", () => ({
  createRequestContext: () => ({ requestId: "req-cron-1" }),
}));

import { POST, GET } from "../../app/api/v1/push/streak-alerts/route";
import { sendStreakAlertNotifications } from "@/services/notificationService";

const mockedSend = vi.mocked(sendStreakAlertNotifications);

function cronRequest(secret?: string) {
  return new Request("http://localhost/api/v1/push/streak-alerts", {
    method: "POST",
    headers: secret === undefined ? {} : { "x-cron-secret": secret },
  }) as never;
}

// Vercel Cron hits the endpoint with a GET and an `Authorization: Bearer …`.
function cronGetRequest(bearer?: string) {
  return new Request("http://localhost/api/v1/push/streak-alerts", {
    method: "GET",
    headers: bearer === undefined ? {} : { authorization: bearer },
  }) as never;
}

describe("POST /api/v1/push/streak-alerts – always-on cron secret (#205)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSend.mockResolvedValue({ sent: 2 });
    envState.secret = "cron-secret";
  });

  it("sends alerts with the correct x-cron-secret header", async () => {
    const response = await POST(cronRequest("cron-secret"));
    const body = (await response.json()) as { sent: number };

    expect(response.status).toBe(200);
    expect(body.sent).toBe(2);
    expect(mockedSend).toHaveBeenCalledOnce();
  });

  it("trims the configured secret before comparing (existing contract)", async () => {
    envState.secret = "  cron-secret\n";

    const response = await POST(cronRequest("cron-secret"));

    expect(response.status).toBe(200);
    expect(mockedSend).toHaveBeenCalledOnce();
  });

  it("returns 503 CRON_NOT_CONFIGURED when the secret is unset — no development bypass", async () => {
    envState.secret = undefined;

    const response = await POST(cronRequest("anything"));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(503);
    expect(body.code).toBe("CRON_NOT_CONFIGURED");
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("returns 401 for a wrong secret", async () => {
    const response = await POST(cronRequest("wrong"));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("returns 401 when the header is missing entirely", async () => {
    const response = await POST(cronRequest());

    expect(response.status).toBe(401);
    expect(mockedSend).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/push/streak-alerts – Vercel Cron (Authorization: Bearer)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSend.mockResolvedValue({ sent: 3 });
    envState.secret = "cron-secret";
  });

  it("sends alerts for the correct Bearer token (as Vercel Cron attaches)", async () => {
    const response = await GET(cronGetRequest("Bearer cron-secret"));
    const body = (await response.json()) as { sent: number };

    expect(response.status).toBe(200);
    expect(body.sent).toBe(3);
    expect(mockedSend).toHaveBeenCalledOnce();
  });

  it("returns 401 for a wrong Bearer token", async () => {
    const response = await GET(cronGetRequest("Bearer nope"));

    expect(response.status).toBe(401);
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("returns 401 without an Authorization header", async () => {
    const response = await GET(cronGetRequest());

    expect(response.status).toBe(401);
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("returns 503 when the secret is unset", async () => {
    envState.secret = undefined;

    const response = await GET(cronGetRequest("Bearer cron-secret"));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(503);
    expect(body.code).toBe("CRON_NOT_CONFIGURED");
    expect(mockedSend).not.toHaveBeenCalled();
  });
});
