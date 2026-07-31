/**
 * Route-Tests für /api/v1/learn/progress — den geräteübergreifenden
 * „Weitermachen"-Merker (#610).
 *
 * Festgenagelt wird, was hier wirklich schiefgehen kann:
 *   * ohne Anmeldung wird nichts gelesen, geschrieben oder gelöscht;
 *   * gespeichert wird für den Nutzer des TOKENS — eine im Rumpf
 *     mitgeschickte userId zählt nicht (Identität ist serverseitig);
 *   * ein fremdes oder gelöschtes Deck liefert 404 statt einer Zeile;
 *   * eine Position am oder hinter dem Ende ist eine fertige Runde und wird
 *     abgelehnt, bevor die Datenbank sie sieht.
 *
 * `@/lib/http` ist mit schlanken Response-Attrappen ersetzt, damit der Test
 * `next/server` nie laden muss; `@/lib/db` ist ersetzt, damit kein echter
 * Supabase-Client läuft.
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
  createRequestContext: () => ({ requestId: "req-progress-1" }),
}));
vi.mock("@/lib/db", () => ({
  getSessionProgress: vi.fn(),
  saveSessionProgress: vi.fn(),
  clearSessionProgress: vi.fn(),
}));

import { DELETE, GET, PUT } from "../../app/api/v1/learn/progress/route";
import { getAuthUser } from "@/lib/auth";
import { clearSessionProgress, getSessionProgress, saveSessionProgress } from "@/lib/db";

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedGet = vi.mocked(getSessionProgress);
const mockedSave = vi.mocked(saveSessionProgress);
const mockedClear = vi.mocked(clearSessionProgress);

const AUTH_USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const DECK_ID = "33333333-3333-4333-8333-333333333333";
const CARD_ID = "44444444-4444-4444-8444-444444444444";

function getRequest(query: string) {
  return new Request(`http://localhost/api/v1/learn/progress${query}`, {
    method: "GET",
  }) as never;
}

function putRequest(body: unknown) {
  return new Request("http://localhost/api/v1/learn/progress", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }) as never;
}

function deleteRequest(query: string) {
  return new Request(`http://localhost/api/v1/learn/progress${query}`, {
    method: "DELETE",
  }) as never;
}

const validBody = {
  deckId: DECK_ID,
  mode: "flashcards" as const,
  index: 8,
  cardId: CARD_ID,
  source: "all",
  reverse: false,
  total: 40,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetAuthUser.mockResolvedValue({ userId: AUTH_USER_ID, email: "lara@example.com" });
  mockedSave.mockResolvedValue(true);
  mockedGet.mockResolvedValue(null);
  mockedClear.mockResolvedValue(undefined);
});

describe("GET /api/v1/learn/progress", () => {
  it("lehnt ohne Anmeldung ab, ohne die Datenbank anzufassen", async () => {
    mockedGetAuthUser.mockResolvedValue(null);
    const res = await GET(getRequest(`?deckId=${DECK_ID}&mode=flashcards`));
    expect(res.status).toBe(401);
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("liest die Position des angemeldeten Nutzers", async () => {
    mockedGet.mockResolvedValue({
      index: 8,
      cardId: CARD_ID,
      source: "all",
      reverse: false,
      total: 40,
      updatedAt: "2026-07-30T10:00:00.000Z",
    });
    const res = await GET(getRequest(`?deckId=${DECK_ID}&mode=cloze`));
    expect(res.status).toBe(200);
    expect(mockedGet).toHaveBeenCalledWith(AUTH_USER_ID, DECK_ID, "cloze");
    await expect(res.json()).resolves.toMatchObject({ progress: { index: 8 } });
  });

  it("liefert null, wenn nichts gemerkt ist", async () => {
    const res = await GET(getRequest(`?deckId=${DECK_ID}&mode=flashcards`));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ progress: null });
  });

  it("weist unbrauchbare Parameter ab", async () => {
    expect((await GET(getRequest("?deckId=keine-uuid&mode=flashcards"))).status).toBe(400);
    expect((await GET(getRequest(`?deckId=${DECK_ID}&mode=quiz`))).status).toBe(400);
    expect((await GET(getRequest(`?deckId=${DECK_ID}`))).status).toBe(400);
  });
});

describe("PUT /api/v1/learn/progress", () => {
  it("lehnt ohne Anmeldung ab, ohne zu schreiben", async () => {
    mockedGetAuthUser.mockResolvedValue(null);
    const res = await PUT(putRequest(validBody));
    expect(res.status).toBe(401);
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it("schreibt für den Nutzer des Tokens, nicht für eine mitgeschickte userId", async () => {
    const res = await PUT(putRequest({ ...validBody, userId: OTHER_USER_ID }));
    expect(res.status).toBe(200);
    expect(mockedSave).toHaveBeenCalledWith(AUTH_USER_ID, DECK_ID, "flashcards", {
      index: 8,
      cardId: CARD_ID,
      source: "all",
      reverse: false,
      total: 40,
    });
  });

  it("reicht die Ergebnisse der Vor-Sitzung mit durch", async () => {
    await PUT(
      putRequest({
        ...validBody,
        results: { [CARD_ID]: { correct: true, overridden: false } },
      })
    );
    expect(mockedSave).toHaveBeenCalledWith(
      AUTH_USER_ID,
      DECK_ID,
      "flashcards",
      expect.objectContaining({
        results: { [CARD_ID]: { correct: true, overridden: false } },
      })
    );
  });

  it("antwortet 404, wenn das Deck nicht dem Nutzer gehört", async () => {
    mockedSave.mockResolvedValue(false);
    const res = await PUT(putRequest(validBody));
    expect(res.status).toBe(404);
  });

  it("lehnt eine fertige Runde ab (Position am oder hinter dem Ende)", async () => {
    expect((await PUT(putRequest({ ...validBody, index: 40, total: 40 }))).status).toBe(400);
    expect((await PUT(putRequest({ ...validBody, index: 99, total: 40 }))).status).toBe(400);
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it("lehnt unbrauchbare Rümpfe ab", async () => {
    expect((await PUT(putRequest({ ...validBody, index: -1 }))).status).toBe(400);
    expect((await PUT(putRequest({ ...validBody, total: 0 }))).status).toBe(400);
    expect((await PUT(putRequest({ ...validBody, cardId: "keine-uuid" }))).status).toBe(400);
    expect((await PUT(putRequest({ ...validBody, mode: "quiz" }))).status).toBe(400);
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it("deckelt total gegen missbräuchlich große Runden (#702)", async () => {
    const res = await PUT(putRequest({ ...validBody, index: 0, total: 2001 }));
    expect(res.status).toBe(400);
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it("lehnt results mit mehr Einträgen als total ab (#702)", async () => {
    // total: 1, aber zwei Ergebnis-Einträge — ohne Deckel ließe sich eine
    // jsonb-Zeile beliebig groß machen, unabhängig von der echten Rundenlänge.
    const res = await PUT(
      putRequest({
        ...validBody,
        index: 0,
        total: 1,
        results: {
          [CARD_ID]: { correct: true, overridden: false },
          "55555555-5555-4555-8555-555555555555": { correct: false, overridden: false },
        },
      })
    );
    expect(res.status).toBe(400);
    expect(mockedSave).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/learn/progress", () => {
  it("lehnt ohne Anmeldung ab, ohne zu löschen", async () => {
    mockedGetAuthUser.mockResolvedValue(null);
    const res = await DELETE(deleteRequest(`?deckId=${DECK_ID}&mode=flashcards`));
    expect(res.status).toBe(401);
    expect(mockedClear).not.toHaveBeenCalled();
  });

  it("löscht den Merker des angemeldeten Nutzers", async () => {
    const res = await DELETE(deleteRequest(`?deckId=${DECK_ID}&mode=flashcards`));
    expect(res.status).toBe(200);
    expect(mockedClear).toHaveBeenCalledWith(AUTH_USER_ID, DECK_ID, "flashcards");
  });

  it("weist unbrauchbare Parameter ab", async () => {
    expect((await DELETE(deleteRequest("?deckId=keine-uuid&mode=cloze"))).status).toBe(400);
    expect(mockedClear).not.toHaveBeenCalled();
  });
});
