/**
 * Auth guards on the scaffold routes (#205).
 *
 * /api/v1/b2b/classes and /api/v1/community/decks are in-memory SCAFFOLDs
 * (issue #80) that used to be fully public. They must now reject
 * unauthenticated callers with 401 while staying functional for authenticated
 * users.
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
vi.mock("@/lib/observability", () => ({
  createRequestContext: () => ({ requestId: "req-scaffold-1" }),
}));
vi.mock("@/services/b2bService", () => ({
  listB2bClasses: vi.fn().mockReturnValue([]),
  createB2bClass: vi.fn().mockReturnValue({ id: "class-1" }),
}));
vi.mock("@/services/communityDeckService", () => ({
  listCommunityDecks: vi.fn().mockReturnValue([]),
  publishCommunityDeck: vi.fn().mockReturnValue({ id: "deck-1" }),
}));

import { GET as b2bGet, POST as b2bPost } from "../../app/api/v1/b2b/classes/route";
import { GET as communityGet, POST as communityPost } from "../../app/api/v1/community/decks/route";
import { getAuthUser } from "@/lib/auth";
import { listB2bClasses, createB2bClass } from "@/services/b2bService";
import { listCommunityDecks, publishCommunityDeck } from "@/services/communityDeckService";

const mockedGetAuthUser = vi.mocked(getAuthUser);

const AUTH_USER = { userId: "11111111-1111-4111-8111-111111111111", email: "lara@example.com" };

function getRequest(url: string) {
  const request = new Request(url) as Request & { nextUrl: URL };
  request.nextUrl = new URL(url);
  return request as never;
}

function postRequest(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }) as never;
}

describe("scaffold routes require auth (#205)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthUser.mockResolvedValue(AUTH_USER);
  });

  describe("GET/POST /api/v1/b2b/classes", () => {
    it("GET returns 401 without a token and never touches the service", async () => {
      mockedGetAuthUser.mockResolvedValue(null);

      const response = await b2bGet(getRequest("http://localhost/api/v1/b2b/classes?tenantId=tenant-1"));
      const body = (await response.json()) as { code: string };

      expect(response.status).toBe(401);
      expect(body.code).toBe("UNAUTHORIZED");
      expect(listB2bClasses).not.toHaveBeenCalled();
    });

    it("POST returns 401 without a token and never touches the service", async () => {
      mockedGetAuthUser.mockResolvedValue(null);

      const response = await b2bPost(postRequest("http://localhost/api/v1/b2b/classes", { name: "8b" }));

      expect(response.status).toBe(401);
      expect(createB2bClass).not.toHaveBeenCalled();
    });

    it("stays functional for authenticated users (GET 200, POST 201)", async () => {
      const getResponse = await b2bGet(getRequest("http://localhost/api/v1/b2b/classes?tenantId=tenant-1"));
      expect(getResponse.status).toBe(200);
      expect(listB2bClasses).toHaveBeenCalledWith("tenant-1");

      const postResponse = await b2bPost(postRequest("http://localhost/api/v1/b2b/classes", { name: "8b" }));
      expect(postResponse.status).toBe(201);
      expect(createB2bClass).toHaveBeenCalled();
    });
  });

  describe("GET/POST /api/v1/community/decks", () => {
    it("GET returns 401 without a token and never touches the service", async () => {
      mockedGetAuthUser.mockResolvedValue(null);

      const response = await communityGet(getRequest("http://localhost/api/v1/community/decks"));
      const body = (await response.json()) as { code: string };

      expect(response.status).toBe(401);
      expect(body.code).toBe("UNAUTHORIZED");
      expect(listCommunityDecks).not.toHaveBeenCalled();
    });

    it("POST returns 401 without a token and never touches the service", async () => {
      mockedGetAuthUser.mockResolvedValue(null);

      const response = await communityPost(postRequest("http://localhost/api/v1/community/decks", { title: "Bio" }));

      expect(response.status).toBe(401);
      expect(publishCommunityDeck).not.toHaveBeenCalled();
    });

    it("stays functional for authenticated users (GET 200, POST 201)", async () => {
      const getResponse = await communityGet(getRequest("http://localhost/api/v1/community/decks?status=flagged"));
      expect(getResponse.status).toBe(200);
      expect(listCommunityDecks).toHaveBeenCalledWith("flagged");

      const postResponse = await communityPost(postRequest("http://localhost/api/v1/community/decks", { title: "Bio" }));
      expect(postResponse.status).toBe(201);
      expect(publishCommunityDeck).toHaveBeenCalled();
    });
  });
});
