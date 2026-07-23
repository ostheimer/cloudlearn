/**
 * Route-Test für GET /api/v1/stats/tests — die letzten fünf Prüfungen.
 *
 * Der eigentliche „Deck gelöscht → Prüfung weg"-Filter lebt in der SQL von
 * getLastTestAttempts (inner join + deleted_at is null) und wird dort geprüft;
 * hier sichern wir den Routen-Vertrag: ohne Token 401, sonst reicht die Route
 * die (bereits gefilterte) Liste des AUTHENTIFIZIERTEN Nutzers durch.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/http", () => ({
  jsonOk: (_requestId: string, data: unknown, status = 200) => ({ status, json: async () => data }),
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
  createRequestContext: () => ({ requestId: "req-stats-tests-1" }),
}));
vi.mock("@/lib/db", () => ({ getLastTestAttempts: vi.fn() }));

import { GET } from "../../app/api/v1/stats/tests/route";
import { getAuthUser } from "@/lib/auth";
import { getLastTestAttempts } from "@/lib/db";

const USER = "11111111-1111-4111-8111-111111111111";

function get() {
  return GET({ headers: new Headers() } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthUser).mockResolvedValue({ userId: USER } as never);
});

describe("GET /api/v1/stats/tests", () => {
  it("weist ohne Token ab (401) und liest nichts", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never);

    const res = await get();

    expect(res.status).toBe(401);
    expect(getLastTestAttempts).not.toHaveBeenCalled();
  });

  it("liest die letzten fünf des AUTHENTIFIZIERTEN Nutzers und reicht sie durch", async () => {
    const attempts = [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        deckId: "22222222-2222-4222-8222-222222222222",
        deckTitle: "Cybercrime",
        questionCount: 30,
        correctCount: 18,
        submittedAt: "2026-07-23T10:00:00.000Z",
      },
    ];
    vi.mocked(getLastTestAttempts).mockResolvedValue(attempts as never);

    const res = await get();

    expect(res.status).toBe(200);
    expect(getLastTestAttempts).toHaveBeenCalledWith(USER, 5);
    expect((await res.json()).attempts).toEqual(attempts);
  });

  it("gibt eine leere Liste zurück, wenn es noch keine Prüfung gibt", async () => {
    vi.mocked(getLastTestAttempts).mockResolvedValue([] as never);

    const res = await get();

    expect(res.status).toBe(200);
    expect((await res.json()).attempts).toEqual([]);
  });
});
