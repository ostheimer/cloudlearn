/**
 * Route-level tests for POST /api/v1/math/formula.
 *
 * Security regression tests for #204: the route used to trust a client-supplied
 * `userId` in the request body with NO auth check, letting anyone drain or
 * manipulate any user's persistent Mathpix budget. The route must now require
 * a valid auth token and take the user id exclusively from it — a `userId`
 * smuggled into the body must be ignored.
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

describe("POST /api/v1/math/formula – auth required, userId from token (#204)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockResolvedValue({ userId: AUTH_USER_ID, email: "lara@example.com" });
    mockedCanProcess.mockResolvedValue(true);
    mockedConsume.mockResolvedValue(0.002);
    mockedGetSpend.mockResolvedValue(0.004);
  });

  it("returns 401 UNAUTHORIZED without a valid token and never touches the budget", async () => {
    mockedGetAuthUser.mockResolvedValue(null);

    const response = await POST(makeRequest({ imageUrl: "https://example.com/f.png" }));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(mockedCanProcess).not.toHaveBeenCalled();
    expect(mockedConsume).not.toHaveBeenCalled();
    expect(mockedGetSpend).not.toHaveBeenCalled();
  });

  it("charges the AUTH user and ignores a userId smuggled into the body", async () => {
    const response = await POST(
      makeRequest({ imageUrl: "https://example.com/f.png", userId: VICTIM_USER_ID })
    );
    const body = (await response.json()) as { latex: string; spentUsd: number; totalSpendUsd: number };

    expect(response.status).toBe(201);
    expect(body.latex).toBe("\\\\text{mock-formula}");
    expect(body.spentUsd).toBe(0.002);
    expect(body.totalSpendUsd).toBe(0.004);

    expect(mockedCanProcess).toHaveBeenCalledWith(AUTH_USER_ID);
    expect(mockedConsume).toHaveBeenCalledWith(AUTH_USER_ID);
    expect(mockedGetSpend).toHaveBeenCalledWith(AUTH_USER_ID);
    expect(mockedCanProcess).not.toHaveBeenCalledWith(VICTIM_USER_ID);
    expect(mockedConsume).not.toHaveBeenCalledWith(VICTIM_USER_ID);
  });

  it("returns 402 MATHPIX_BUDGET_EXCEEDED and does not consume when over budget", async () => {
    mockedCanProcess.mockResolvedValue(false);

    const response = await POST(makeRequest({ imageUrl: "https://example.com/f.png" }));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(402);
    expect(body.code).toBe("MATHPIX_BUDGET_EXCEEDED");
    expect(mockedCanProcess).toHaveBeenCalledWith(AUTH_USER_ID);
    expect(mockedConsume).not.toHaveBeenCalled();
  });
});
