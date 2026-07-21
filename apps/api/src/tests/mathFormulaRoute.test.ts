/**
 * Route-level tests for POST /api/v1/math/formula.
 *
 * The route is retired (#425): it never called Mathpix, it returned a
 * hard-coded `"\\text{mock-formula}"` and charged the real, persistent budget
 * in `mathpix_usage` for it. It now answers 501 and consumes nothing.
 *
 * Two guarantees are locked in here:
 *   - #425: no budget call happens on ANY path — a made-up answer must never
 *     cost real money again.
 *   - #204: auth is still required and the user id still comes from the token,
 *     never from the body. The route used to trust a client-supplied `userId`
 *     with no auth check, letting anyone drain any user's budget. Keeping this
 *     test alive means wiring Mathpix up later cannot silently reopen the hole.
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
vi.mock("@/services/mathpixService", () => ({
  canProcessMathpix: vi.fn(),
  consumeMathpixCost: vi.fn(),
  getMathpixSpend: vi.fn(),
}));
vi.mock("@/lib/observability", () => ({
  createRequestContext: () => ({ requestId: "req-math-1" }),
}));

import { POST } from "../../app/api/v1/math/formula/route";
import { getAuthUser } from "@/lib/auth";
import { canProcessMathpix, consumeMathpixCost, getMathpixSpend } from "@/services/mathpixService";

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedCanProcess = vi.mocked(canProcessMathpix);
const mockedConsume = vi.mocked(consumeMathpixCost);
const mockedGetSpend = vi.mocked(getMathpixSpend);

const AUTH_USER_ID = "11111111-1111-4111-8111-111111111111";
const VICTIM_USER_ID = "99999999-9999-4999-8999-999999999999";

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/v1/math/formula", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }) as never;
}

function expectNoBudgetCall() {
  expect(mockedCanProcess).not.toHaveBeenCalled();
  expect(mockedConsume).not.toHaveBeenCalled();
  expect(mockedGetSpend).not.toHaveBeenCalled();
}

describe("POST /api/v1/math/formula – retired, consumes no budget (#425)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockResolvedValue({ userId: AUTH_USER_ID, email: "lara@example.com" });
  });

  it("returns 501 for an authenticated caller instead of a mock formula", async () => {
    const response = await POST(makeRequest({ imageUrl: "https://example.com/f.png" }));
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(501);
    expect(body.code).toBe("MATH_FORMULA_NOT_IMPLEMENTED");
    expect(body.message).toContain("noch nicht verfügbar");
  });

  it("never touches the Mathpix budget, not even for an authenticated caller", async () => {
    await POST(makeRequest({ imageUrl: "https://example.com/f.png" }));

    expectNoBudgetCall();
  });

  it("ignores a userId smuggled into the body and charges nobody (#204)", async () => {
    const response = await POST(
      makeRequest({ imageUrl: "https://example.com/f.png", userId: VICTIM_USER_ID })
    );

    expect(response.status).toBe(501);
    expectNoBudgetCall();
  });

  it("still returns 401 UNAUTHORIZED without a valid token (#204)", async () => {
    mockedGetAuthUser.mockResolvedValue(null);

    const response = await POST(makeRequest({ imageUrl: "https://example.com/f.png" }));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expectNoBudgetCall();
  });
});
