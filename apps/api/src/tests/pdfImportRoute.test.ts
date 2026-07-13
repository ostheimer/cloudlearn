/**
 * Route-level tests for POST /api/v1/import/pdf.
 *
 * The fairness fix lives in the route wiring: LP are charged up front, and if
 * processPdfImport throws (e.g. a scan-only PDF → 422 PDF_TEXT_NOT_FOUND) the
 * route must refund the LP before re-throwing the original error. These tests
 * mock the collaborators and assert that wiring directly.
 *
 * `@/lib/http` is mocked with light Response-shaped fakes so the test never has
 * to load `next/server` — it exercises the route's branching, not Next's
 * response plumbing.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/http", () => {
  class HttpError extends Error {
    status: number;
    code: string;
    constructor(message: string, status: number, code: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return {
    HttpError,
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
  };
});

vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({ RATE_LIMIT_FREE_PER_MINUTE: 20, RATE_LIMIT_PRO_PER_MINUTE: 60 }),
}));
vi.mock("@/services/subscriptionService", () => ({ getSubscriptionStatus: vi.fn() }));
vi.mock("@/services/lpService", () => ({ spendLp: vi.fn() }));
vi.mock("@/lib/lpRefund", () => ({ refundOnFailure: vi.fn() }));
vi.mock("@/services/pdfImportService", () => ({
  processPdfImport: vi.fn(),
  getPdfJob: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({
  createRequestContext: () => ({ requestId: "req-pdf-1" }),
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

import { GET, POST } from "../../app/api/v1/import/pdf/route";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import { spendLp } from "@/services/lpService";
import { refundOnFailure } from "@/lib/lpRefund";
import { getPdfJob, processPdfImport } from "@/services/pdfImportService";
import { HttpError } from "@/lib/http";

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetSubscription = vi.mocked(getSubscriptionStatus);
const mockedSpendLp = vi.mocked(spendLp);
const mockedRefundOnFailure = vi.mocked(refundOnFailure);
const mockedProcessPdfImport = vi.mocked(processPdfImport);
const mockedGetPdfJob = vi.mocked(getPdfJob);

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "99999999-9999-4999-8999-999999999999";

function makeRequest() {
  return new Request("http://localhost/api/v1/import/pdf", {
    method: "POST",
    body: JSON.stringify({ fileBase64: "AAA", fileName: "notes.pdf", idempotencyKey: "k1" }),
    headers: { "content-type": "application/json" },
  }) as never;
}

const okResult = {
  requestId: "req-pdf-1",
  model: "gemini-2.5",
  fallbackUsed: false,
  cards: [{ front: "q", back: "a" }],
  deckTitle: "Notes",
  fileName: "notes.pdf",
  pageCount: 3,
  extractedCharacters: 500,
};

describe("POST /api/v1/import/pdf – LP refund on failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockResolvedValue({ userId: USER_ID, email: "lara@example.com" });
    mockedCheckRateLimit.mockResolvedValue(true);
    mockedGetSubscription.mockResolvedValue({ tier: "free" } as never);
  });

  it("does NOT refund on success", async () => {
    mockedSpendLp.mockResolvedValue({ allowed: true, newBalance: 80, cost: 20 });
    mockedProcessPdfImport.mockResolvedValue(okResult as never);

    const response = await POST(makeRequest());
    const body = (await response.json()) as { usage: { lpSpent: number; lpBalance: number } };

    expect(response.status).toBe(200);
    expect(body.usage).toEqual({ lpSpent: 20, lpBalance: 80 });
    expect(mockedRefundOnFailure).not.toHaveBeenCalled();
  });

  it("refunds the LP when processing throws, and surfaces the original error", async () => {
    mockedSpendLp.mockResolvedValue({ allowed: true, newBalance: 80, cost: 20 });
    mockedProcessPdfImport.mockRejectedValue(
      new HttpError("Kein Text im PDF.", 422, "PDF_TEXT_NOT_FOUND")
    );

    const response = await POST(makeRequest());
    const body = (await response.json()) as { code: string };

    // Original processing error is what the user sees …
    expect(response.status).toBe(422);
    expect(body.code).toBe("PDF_TEXT_NOT_FOUND");
    // … and the 20 LP were handed back for this exact request.
    expect(mockedRefundOnFailure).toHaveBeenCalledWith(
      USER_ID,
      20,
      "refund_pdfImport_failed",
      "req-pdf-1"
    );
  });

  it("returns 402 and never charges/refunds when balance is insufficient", async () => {
    mockedSpendLp.mockResolvedValue({ allowed: false, newBalance: 5, cost: 20 });

    const response = await POST(makeRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(402);
    expect(body.code).toBe("INSUFFICIENT_LP");
    expect(mockedProcessPdfImport).not.toHaveBeenCalled();
    expect(mockedRefundOnFailure).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests before any LP is touched", async () => {
    mockedGetAuthUser.mockResolvedValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    expect(mockedSpendLp).not.toHaveBeenCalled();
    expect(mockedRefundOnFailure).not.toHaveBeenCalled();
  });
});

function makeStatusRequest(jobId?: string) {
  const url = `http://localhost/api/v1/import/pdf${jobId ? `?jobId=${jobId}` : ""}`;
  const request = new Request(url) as Request & { nextUrl: URL };
  request.nextUrl = new URL(url);
  return request as never;
}

describe("GET /api/v1/import/pdf – job status requires auth + ownership (#205)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockResolvedValue({ userId: USER_ID, email: "lara@example.com" });
  });

  it("returns 401 without a valid token and never looks up the job", async () => {
    mockedGetAuthUser.mockResolvedValue(null);

    const response = await GET(makeStatusRequest("job-1"));

    expect(response.status).toBe(401);
    expect(mockedGetPdfJob).not.toHaveBeenCalled();
  });

  it("returns 400 when jobId is missing", async () => {
    const response = await GET(makeStatusRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe("MISSING_JOB_ID");
  });

  it("returns the job when it belongs to the caller", async () => {
    mockedGetPdfJob.mockReturnValue({ id: "job-1", userId: USER_ID, status: "completed" } as never);

    const response = await GET(makeStatusRequest("job-1"));
    const body = (await response.json()) as { job: { id: string } };

    expect(response.status).toBe(200);
    expect(body.job.id).toBe("job-1");
  });

  it("returns 404 for a missing job", async () => {
    mockedGetPdfJob.mockReturnValue(null);

    const response = await GET(makeStatusRequest("job-x"));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(404);
    expect(body.code).toBe("JOB_NOT_FOUND");
  });

  it("returns the SAME 404 for someone else's job (no existence leak)", async () => {
    mockedGetPdfJob.mockReturnValue({ id: "job-2", userId: OTHER_USER_ID, status: "completed" } as never);

    const response = await GET(makeStatusRequest("job-2"));
    const foreignBody = (await response.json()) as { code: string; message: string };

    mockedGetPdfJob.mockReturnValue(null);
    const missingResponse = await GET(makeStatusRequest("job-2"));
    const missingBody = (await missingResponse.json()) as { code: string; message: string };

    expect(response.status).toBe(404);
    expect(missingResponse.status).toBe(404);
    // Indistinguishable responses: same code and message either way.
    expect(foreignBody).toEqual(missingBody);
  });
});
