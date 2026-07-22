/**
 * Route-level tests for the folder endpoints (die Kurs-Hälfte fiel mit #437) — the IDOR fix
 * (broken object-level authorization). Folders are read/modified/
 * deleted through the admin Supabase client, which bypasses RLS, so ownership
 * MUST be enforced in code by scoping every query to the token's user id.
 *
 * These tests run the real services + routes and mock only `@/lib/db`, pinning
 * down the route↔service contract:
 *   * every db call is scoped with the AUTHENTICATED user id (never a body one);
 *   * a userId smuggled into a PATCH body is ignored (identity is the token);
 *   * when the scoped lookup reports not-owned (null folder, false link
 *     op, null deck list), the route answers 404 — existence isn't leaked.
 *
 * `@/lib/http` is mocked with light Response-shaped fakes so the tests never
 * load `next/server`; `@/lib/db` is mocked so no real Supabase client runs.
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
  createRequestContext: () => ({ requestId: "req-idor-1" }),
}));
vi.mock("@/lib/db", () => ({
  // folderService imports
  createFolder: vi.fn(),
  listFolders: vi.fn(),
  getFolder: vi.fn(),
  updateFolder: vi.fn(),
  deleteFolder: vi.fn(),
  addDeckToFolder: vi.fn(),
  removeDeckFromFolder: vi.fn(),
  listDecksInFolder: vi.fn(),
  listFoldersForDeck: vi.fn(),
  setFolderDeckOrder: vi.fn(),
}));

import { GET as folderGet, PATCH as folderPatch, DELETE as folderDelete } from "../../app/api/v1/folders/[id]/route";
import {
  GET as folderDecksGet,
  POST as folderDecksPost,
  PUT as folderDecksPut,
  DELETE as folderDecksDelete,
} from "../../app/api/v1/folders/[id]/decks/route";
import { getAuthUser } from "@/lib/auth";
import {
  getFolder,
  updateFolder,
  deleteFolder,
  addDeckToFolder,
  removeDeckFromFolder,
  listDecksInFolder,
  setFolderDeckOrder,
} from "@/lib/db";

const mockedGetAuthUser = vi.mocked(getAuthUser);

const AUTH_USER_ID = "11111111-1111-4111-8111-111111111111";
// The id a hostile client tries to smuggle into a request body.
const BODY_USER_ID = "22222222-2222-4222-8222-222222222222";
const FOLDER_ID = "44444444-4444-4444-8444-444444444444";
const DECK_ID = "55555555-5555-4555-8555-555555555555";

const folderRow = {
  id: FOLDER_ID,
  userId: AUTH_USER_ID,
  title: "Klasse 10",
  description: null,
  parentId: null,
  color: null,
  createdAt: "2026-07-15T00:00:00.000Z",
  updatedAt: "2026-07-15T00:00:00.000Z",
};

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as never;
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetAuthUser.mockResolvedValue({ userId: AUTH_USER_ID, email: "lara@example.com" });
});

// ─── Folders ──────────────────────── ────────────────────────────────────────

describe("GET /api/v1/folders/[id] — owner-scoped read", () => {
  it("returns the folder scoped to the token user (owner path)", async () => {
    vi.mocked(getFolder).mockResolvedValue(folderRow);

    const res = await folderGet(req(`http://localhost/api/v1/folders/${FOLDER_ID}`), ctx(FOLDER_ID));
    const body = (await res.json()) as { folder: typeof folderRow };

    expect(res.status).toBe(200);
    expect(body.folder.id).toBe(FOLDER_ID);
    expect(getFolder).toHaveBeenCalledWith(FOLDER_ID, AUTH_USER_ID);
  });

  it("returns 404 when the folder isn't owned by the caller", async () => {
    vi.mocked(getFolder).mockResolvedValue(null);

    const res = await folderGet(req(`http://localhost/api/v1/folders/${FOLDER_ID}`), ctx(FOLDER_ID));
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(404);
    expect(body.code).toBe("FOLDER_NOT_FOUND");
    expect(getFolder).toHaveBeenCalledWith(FOLDER_ID, AUTH_USER_ID);
  });
});

describe("PATCH /api/v1/folders/[id] — owner-scoped update, body userId ignored", () => {
  it("updates using the TOKEN user id, ignoring a userId smuggled into the body", async () => {
    vi.mocked(updateFolder).mockResolvedValue({ ...folderRow, title: "Hacked" });

    const res = await folderPatch(
      req(`http://localhost/api/v1/folders/${FOLDER_ID}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "Hacked", userId: BODY_USER_ID }),
        headers: { "content-type": "application/json" },
      }),
      ctx(FOLDER_ID)
    );

    expect(res.status).toBe(200);
    expect(updateFolder).toHaveBeenCalledWith(FOLDER_ID, AUTH_USER_ID, { title: "Hacked" });
  });

  it("returns 404 when the folder isn't owned", async () => {
    vi.mocked(updateFolder).mockResolvedValue(null);

    const res = await folderPatch(
      req(`http://localhost/api/v1/folders/${FOLDER_ID}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "x" }),
        headers: { "content-type": "application/json" },
      }),
      ctx(FOLDER_ID)
    );

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/v1/folders/[id] — owner-scoped delete", () => {
  it("deletes for the owner and reports success", async () => {
    vi.mocked(deleteFolder).mockResolvedValue(true);

    const res = await folderDelete(
      req(`http://localhost/api/v1/folders/${FOLDER_ID}`, { method: "DELETE" }),
      ctx(FOLDER_ID)
    );

    expect(res.status).toBe(200);
    expect(deleteFolder).toHaveBeenCalledWith(FOLDER_ID, AUTH_USER_ID);
  });

  it("returns 404 when the folder isn't owned (nothing deleted)", async () => {
    vi.mocked(deleteFolder).mockResolvedValue(false);

    const res = await folderDelete(
      req(`http://localhost/api/v1/folders/${FOLDER_ID}`, { method: "DELETE" }),
      ctx(FOLDER_ID)
    );
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(404);
    expect(body.code).toBe("FOLDER_NOT_FOUND");
  });
});

describe("/api/v1/folders/[id]/decks — owner-scoped deck links", () => {
  it("lists decks for the owner", async () => {
    vi.mocked(listDecksInFolder).mockResolvedValue([]);

    const res = await folderDecksGet(
      req(`http://localhost/api/v1/folders/${FOLDER_ID}/decks`),
      ctx(FOLDER_ID)
    );

    expect(res.status).toBe(200);
    expect(listDecksInFolder).toHaveBeenCalledWith(FOLDER_ID, AUTH_USER_ID);
  });

  it("returns 404 on list when the folder isn't owned (null, not empty)", async () => {
    vi.mocked(listDecksInFolder).mockResolvedValue(null);

    const res = await folderDecksGet(
      req(`http://localhost/api/v1/folders/${FOLDER_ID}/decks`),
      ctx(FOLDER_ID)
    );
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(404);
    expect(body.code).toBe("FOLDER_NOT_FOUND");
  });

  it("adds a deck scoped to the token user", async () => {
    vi.mocked(addDeckToFolder).mockResolvedValue(true);

    const res = await folderDecksPost(
      req(`http://localhost/api/v1/folders/${FOLDER_ID}/decks`, {
        method: "POST",
        body: JSON.stringify({ deckId: DECK_ID }),
        headers: { "content-type": "application/json" },
      }),
      ctx(FOLDER_ID)
    );

    expect(res.status).toBe(201);
    expect(addDeckToFolder).toHaveBeenCalledWith(FOLDER_ID, AUTH_USER_ID, DECK_ID);
  });

  it("returns 404 on add when the folder or deck isn't owned by the caller", async () => {
    vi.mocked(addDeckToFolder).mockResolvedValue(false);

    const res = await folderDecksPost(
      req(`http://localhost/api/v1/folders/${FOLDER_ID}/decks`, {
        method: "POST",
        body: JSON.stringify({ deckId: DECK_ID }),
        headers: { "content-type": "application/json" },
      }),
      ctx(FOLDER_ID)
    );
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(404);
    expect(body.code).toBe("FOLDER_NOT_FOUND");
  });

  it("reorders decks scoped to the token user (#437)", async () => {
    vi.mocked(setFolderDeckOrder).mockResolvedValue(true);

    const res = await folderDecksPut(
      req(`http://localhost/api/v1/folders/${FOLDER_ID}/decks`, {
        method: "PUT",
        body: JSON.stringify({ deckIds: [DECK_ID] }),
        headers: { "content-type": "application/json" },
      }),
      ctx(FOLDER_ID)
    );

    expect(res.status).toBe(200);
    expect(setFolderDeckOrder).toHaveBeenCalledWith(FOLDER_ID, AUTH_USER_ID, [DECK_ID]);
  });

  it("returns 404 on reorder when the folder isn't owned", async () => {
    vi.mocked(setFolderDeckOrder).mockResolvedValue(false);

    const res = await folderDecksPut(
      req(`http://localhost/api/v1/folders/${FOLDER_ID}/decks`, {
        method: "PUT",
        body: JSON.stringify({ deckIds: [DECK_ID] }),
        headers: { "content-type": "application/json" },
      }),
      ctx(FOLDER_ID)
    );
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(404);
    expect(body.code).toBe("FOLDER_NOT_FOUND");
    expect(setFolderDeckOrder).toHaveBeenCalledWith(FOLDER_ID, AUTH_USER_ID, [DECK_ID]);
  });

  it("removes a deck scoped to the token user", async () => {
    vi.mocked(removeDeckFromFolder).mockResolvedValue(true);

    const res = await folderDecksDelete(
      req(`http://localhost/api/v1/folders/${FOLDER_ID}/decks?deckId=${DECK_ID}`, { method: "DELETE" }),
      ctx(FOLDER_ID)
    );

    expect(res.status).toBe(200);
    expect(removeDeckFromFolder).toHaveBeenCalledWith(FOLDER_ID, AUTH_USER_ID, DECK_ID);
  });

  it("returns 404 on remove when the folder isn't owned", async () => {
    vi.mocked(removeDeckFromFolder).mockResolvedValue(false);

    const res = await folderDecksDelete(
      req(`http://localhost/api/v1/folders/${FOLDER_ID}/decks?deckId=${DECK_ID}`, { method: "DELETE" }),
      ctx(FOLDER_ID)
    );
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(404);
    expect(body.code).toBe("FOLDER_NOT_FOUND");
  });
});
