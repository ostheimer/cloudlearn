/**
 * Beta feedback: service behavior + route-level auth (#205).
 *
 * The route used to be fully public: GET leaked EVERY user's feedback (or any
 * chosen user's via `?userId=`), and POST trusted a client-supplied userId.
 * It now requires auth, GET returns only the caller's own entries, and POST
 * takes the identity exclusively from the verified token.
 *
 * `@/lib/http` is mocked with light Response-shaped fakes so the test never
 * has to load `next/server`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { listBetaFeedback, resetBetaFeedbackStore, submitBetaFeedback } from "@/services/betaFeedbackService";

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
vi.mock("@/lib/observability", () => ({
  createRequestContext: () => ({ requestId: "req-beta-1" }),
}));

import { GET, POST } from "../../app/api/v1/beta/feedback/route";
import { getAuthUser } from "@/lib/auth";

const mockedGetAuthUser = vi.mocked(getAuthUser);

const AUTH_USER_ID = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";
const OTHER_USER_ID = "0b25d170-8d32-47f0-9e4a-5631161fb2b4";

function getRequest(query = "") {
  const url = `http://localhost/api/v1/beta/feedback${query}`;
  const request = new Request(url) as Request & { nextUrl: URL };
  request.nextUrl = new URL(url);
  return request as never;
}

function postRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/v1/beta/feedback", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }) as never;
}

describe("beta feedback service", () => {
  beforeEach(() => {
    resetBetaFeedbackStore();
  });

  it("stores and filters feedback entries", () => {
    submitBetaFeedback({
      userId: AUTH_USER_ID,
      rating: 5,
      message: "Sehr guter Flow",
      category: "ux"
    });
    submitBetaFeedback({
      userId: OTHER_USER_ID,
      rating: 3,
      message: "Sync war heute langsam",
      category: "performance"
    });

    expect(listBetaFeedback()).toHaveLength(2);
    expect(listBetaFeedback(AUTH_USER_ID)).toHaveLength(1);
  });
});

describe("GET/POST /api/v1/beta/feedback – auth required, identity from token (#205)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBetaFeedbackStore();
    mockedGetAuthUser.mockResolvedValue({ userId: AUTH_USER_ID, email: "lara@example.com" });
  });

  it("GET returns 401 without a valid token", async () => {
    mockedGetAuthUser.mockResolvedValue(null);

    const response = await GET(getRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("POST returns 401 without a valid token and stores nothing", async () => {
    mockedGetAuthUser.mockResolvedValue(null);

    const response = await POST(postRequest({ rating: 5, message: "Toll!" }));

    expect(response.status).toBe(401);
    expect(listBetaFeedback()).toHaveLength(0);
  });

  it("GET returns only the caller's own feedback and ignores ?userId=", async () => {
    submitBetaFeedback({ userId: AUTH_USER_ID, rating: 5, message: "Meins", category: "ux" });
    submitBetaFeedback({ userId: OTHER_USER_ID, rating: 1, message: "Fremd", category: "bug" });

    // Attacker-style query targeting the OTHER user must have no effect.
    const response = await GET(getRequest(`?userId=${OTHER_USER_ID}`));
    const body = (await response.json()) as { feedback: Array<{ userId: string; message: string }> };

    expect(response.status).toBe(200);
    expect(body.feedback).toHaveLength(1);
    expect(body.feedback[0]!.userId).toBe(AUTH_USER_ID);
    expect(body.feedback[0]!.message).toBe("Meins");
  });

  it("POST stores under the AUTH user and ignores a userId smuggled into the body", async () => {
    const response = await POST(
      postRequest({ userId: OTHER_USER_ID, rating: 4, message: "Gutes Update", category: "ux" })
    );
    const body = (await response.json()) as { feedback: { userId: string } };

    expect(response.status).toBe(201);
    expect(body.feedback.userId).toBe(AUTH_USER_ID);
    expect(listBetaFeedback(AUTH_USER_ID)).toHaveLength(1);
    expect(listBetaFeedback(OTHER_USER_ID)).toHaveLength(0);
  });
});
