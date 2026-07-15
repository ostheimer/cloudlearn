/**
 * Route-level tests for PATCH /api/v1/daily-goal.
 *
 * The daily learning goal is now user-settable. These tests pin down that:
 *   * an unauthenticated caller is rejected before the database is touched;
 *   * a valid goal is written for the TOKEN's user — a userId smuggled into the
 *     body is ignored (identity is server-controlled);
 *   * out-of-range or non-numeric goals are rejected with 400 before any write.
 *
 * `@/lib/http` is mocked with light Response-shaped fakes so the test never has
 * to load `next/server`; `@/lib/db` is mocked so no real Supabase client runs.
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
vi.mock("@/lib/observability", () => ({
  createRequestContext: () => ({ requestId: "req-daily-goal-1" }),
}));
vi.mock("@/lib/db", () => ({ updateDailyGoal: vi.fn() }));

import { PATCH } from "../../app/api/v1/daily-goal/route";
import { getAuthUser } from "@/lib/auth";
import { updateDailyGoal } from "@/lib/db";

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedUpdateDailyGoal = vi.mocked(updateDailyGoal);

const AUTH_USER_ID = "11111111-1111-4111-8111-111111111111";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/v1/daily-goal", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }) as never;
}

describe("PATCH /api/v1/daily-goal – user-settable daily goal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockResolvedValue({ userId: AUTH_USER_ID, email: "lara@example.com" });
    mockedUpdateDailyGoal.mockResolvedValue(30);
  });

  it("returns 401 UNAUTHORIZED without a valid token and never writes", async () => {
    mockedGetAuthUser.mockResolvedValue(null);

    const response = await PATCH(makeRequest({ dailyGoal: 30 }));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(mockedUpdateDailyGoal).not.toHaveBeenCalled();
  });

  it("updates the goal for the auth user and returns the stored value", async () => {
    mockedUpdateDailyGoal.mockResolvedValue(50);

    const response = await PATCH(makeRequest({ dailyGoal: 50 }));
    const body = (await response.json()) as { requestId: string; dailyGoal: number };

    expect(response.status).toBe(200);
    expect(body.dailyGoal).toBe(50);
    expect(mockedUpdateDailyGoal).toHaveBeenCalledTimes(1);
    expect(mockedUpdateDailyGoal).toHaveBeenCalledWith(AUTH_USER_ID, 50);
  });

  it("ignores a userId smuggled into the body — identity comes from the token", async () => {
    await PATCH(
      makeRequest({ dailyGoal: 20, userId: "99999999-9999-4999-8999-999999999999" })
    );

    expect(mockedUpdateDailyGoal).toHaveBeenCalledTimes(1);
    expect(mockedUpdateDailyGoal).toHaveBeenCalledWith(AUTH_USER_ID, 20);
  });

  it("rejects a goal below the minimum (0) with 400 before writing", async () => {
    const response = await PATCH(makeRequest({ dailyGoal: 0 }));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(mockedUpdateDailyGoal).not.toHaveBeenCalled();
  });

  it("rejects a goal above the maximum (999) with 400 before writing", async () => {
    const response = await PATCH(makeRequest({ dailyGoal: 999 }));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(mockedUpdateDailyGoal).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric goal with 400 before writing", async () => {
    const response = await PATCH(makeRequest({ dailyGoal: "lots" }));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(mockedUpdateDailyGoal).not.toHaveBeenCalled();
  });

  it("rejects a non-integer goal with 400 before writing", async () => {
    const response = await PATCH(makeRequest({ dailyGoal: 12.5 }));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(mockedUpdateDailyGoal).not.toHaveBeenCalled();
  });
});
