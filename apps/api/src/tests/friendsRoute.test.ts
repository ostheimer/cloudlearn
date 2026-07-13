/**
 * Route-level tests for DELETE /api/v1/friends (#205, M8).
 *
 * `friendId` is interpolated into a PostgREST `.or()` filter on the
 * service-role client, so it must be validated as a UUID before use — an
 * arbitrary string could smuggle extra filter syntax into the query.
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
vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/observability", () => ({
  createRequestContext: () => ({ requestId: "req-friends-1" }),
}));

import { DELETE } from "../../app/api/v1/friends/route";
import { getAuthUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedCreateDb = vi.mocked(createSupabaseAdminClient);

const AUTH_USER_ID = "11111111-1111-4111-8111-111111111111";
const FRIEND_ID = "22222222-2222-4222-8222-222222222222";

function deleteRequest(friendId?: string) {
  const url = `http://localhost/api/v1/friends${
    friendId === undefined ? "" : `?friendId=${encodeURIComponent(friendId)}`
  }`;
  return new Request(url, { method: "DELETE" }) as never;
}

function makeDbMock() {
  const or = vi.fn().mockResolvedValue({ data: null, error: null });
  const del = vi.fn().mockReturnValue({ or });
  const from = vi.fn().mockReturnValue({ delete: del });
  return { db: { from } as never, or };
}

describe("DELETE /api/v1/friends – friendId must be a UUID (#205 M8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockResolvedValue({ userId: AUTH_USER_ID, email: "lara@example.com" });
  });

  it("removes the friendship for a valid UUID", async () => {
    const { db, or } = makeDbMock();
    mockedCreateDb.mockReturnValue(db);

    const response = await DELETE(deleteRequest(FRIEND_ID));
    const body = (await response.json()) as { removed: boolean };

    expect(response.status).toBe(200);
    expect(body.removed).toBe(true);
    expect(or).toHaveBeenCalledWith(
      `and(user_id.eq.${AUTH_USER_ID},friend_id.eq.${FRIEND_ID}),and(user_id.eq.${FRIEND_ID},friend_id.eq.${AUTH_USER_ID})`
    );
  });

  it("rejects a non-UUID friendId with 400 before touching the database", async () => {
    const { db } = makeDbMock();
    mockedCreateDb.mockReturnValue(db);

    const response = await DELETE(deleteRequest("evil),and(user_id.neq.x"));
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
    expect(mockedCreateDb).not.toHaveBeenCalled();
  });

  it("rejects a missing friendId with 400", async () => {
    const response = await DELETE(deleteRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_REQUEST");
  });

  it("returns 401 without a valid token", async () => {
    mockedGetAuthUser.mockResolvedValue(null);

    const response = await DELETE(deleteRequest(FRIEND_ID));

    expect(response.status).toBe(401);
    expect(mockedCreateDb).not.toHaveBeenCalled();
  });
});
