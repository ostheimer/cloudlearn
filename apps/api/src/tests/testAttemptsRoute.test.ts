/**
 * Route- + Service-Tests für POST /api/v1/decks/:id/tests.
 *
 * Läuft die echte Route + den echten testAttemptService + das echte
 * zod-Schema; gemockt sind nur `@/lib/db` (kein Supabase), `@/lib/auth`,
 * `@/lib/rateLimit`, `@/lib/observability` und `@/lib/http` (leichte
 * Response-Fakes, damit next/server nicht lädt).
 *
 * Festgehalten wird der Vertrag, den die DB-Tests nicht abdecken: Identität
 * kommt aus Token + Pfad, NIE aus dem Body; der Server zählt selbst und filtert
 * fremde/doppelte Karten; die typisierten Fehler landen mit dem richtigen
 * Status beim Client.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/http", () => {
  // Innerhalb der Factory definiert, weil vi.mock an den Dateianfang gehoben
  // wird und keine äußeren Variablen sehen darf.
  class HttpError extends Error {
    constructor(
      message: string,
      public status: number,
      public code: string
    ) {
      super(message);
      this.name = "HttpError";
    }
  }
  return {
    jsonOk: (_requestId: string, data: unknown, status = 200) => ({
      status,
      json: async () => data,
    }),
    jsonError: (requestId: string, code: string, message: string, status = 400) => ({
      status,
      json: async () => ({ code, message, request_id: requestId }),
    }),
    // Realistisch: liest status/code von einem geworfenen HttpError, damit
    // 404/409/422 nicht als 500 verschwinden. ZodError (hat `issues`) → 422.
    normalizeError: (error: unknown) => {
      if (
        error &&
        typeof error === "object" &&
        "status" in error &&
        typeof (error as { status: unknown }).status === "number"
      ) {
        const e = error as { status: number; code?: string; message?: string };
        return { code: e.code ?? "REQUEST_ERROR", message: e.message ?? "", status: e.status };
      }
      if (error && typeof error === "object" && "issues" in error) {
        return { code: "VALIDATION_ERROR", message: "invalid", status: 422 };
      }
      return {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
        status: 500,
      };
    },
    HttpError,
  };
});
vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/observability", () => ({
  createRequestContext: () => ({ requestId: "req-test-attempt-1" }),
  logInfo: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  getDeck: vi.fn(),
  getDeckCardIds: vi.fn(),
  recordTestAttempt: vi.fn(),
  TEST_ATTEMPT_DECK_CONFLICT: "test_attempt_deck_conflict",
}));

import { POST } from "../../app/api/v1/decks/[id]/tests/route";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { getDeck, getDeckCardIds, recordTestAttempt } from "@/lib/db";

const USER = "11111111-1111-4111-8111-111111111111";
const DECK = "22222222-2222-4222-8222-222222222222";
const CARD_A = "33333333-3333-4333-8333-333333333333";
const CARD_B = "44444444-4444-4444-8444-444444444444";
const CARD_FOREIGN = "55555555-5555-4555-8555-555555555555";

function post(body: unknown, deckId = DECK) {
  return POST(
    { json: async () => body, headers: new Headers() } as never,
    { params: Promise.resolve({ id: deckId }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthUser).mockResolvedValue({ userId: USER } as never);
  vi.mocked(checkRateLimit).mockResolvedValue(true);
  vi.mocked(getDeck).mockResolvedValue({ id: DECK, userId: USER, title: "Bio" } as never);
  vi.mocked(getDeckCardIds).mockResolvedValue(new Set([CARD_A, CARD_B]));
  vi.mocked(recordTestAttempt).mockImplementation(
    async (_u, d, _k, questions, correct) =>
      ({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        deckId: d,
        questionCount: questions,
        correctCount: correct,
        submittedAt: "2026-07-23T10:00:00.000Z",
      }) as never
  );
});

describe("POST /api/v1/decks/:id/tests", () => {
  it("weist ohne Token ab (401) und rührt die DB nicht an", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never);

    const res = await post({ idempotencyKey: "round-key-1", answers: [{ cardId: CARD_A, correct: true }] });

    expect(res.status).toBe(401);
    expect(getDeck).not.toHaveBeenCalled();
    expect(recordTestAttempt).not.toHaveBeenCalled();
  });

  it("nimmt die Identität aus Token + Pfad, nicht aus dem Body", async () => {
    await post({
      // geschmuggelt — muss ignoriert werden
      userId: "99999999-9999-4999-8999-999999999999",
      deckId: "88888888-8888-4888-8888-888888888888",
      idempotencyKey: "round-key-1",
      answers: [{ cardId: CARD_A, correct: true }],
    });

    // Deck wird mit Pfad-ID und Token-User geladen, nie mit den Body-Werten.
    expect(getDeck).toHaveBeenCalledWith(DECK, USER);
    expect(recordTestAttempt).toHaveBeenCalledWith(USER, DECK, "round-key-1", 1, 1);
  });

  it("antwortet 404 für ein fremdes oder gelöschtes Deck (ohne Existenz zu verraten)", async () => {
    vi.mocked(getDeck).mockResolvedValue(null as never);

    const res = await post({ idempotencyKey: "round-key-1", answers: [{ cardId: CARD_A, correct: true }] });

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("DECK_NOT_FOUND");
    expect(recordTestAttempt).not.toHaveBeenCalled();
  });

  it("zählt nur Karten DIESES Decks — fremde cardIds fallen aus dem Nenner", async () => {
    await post({
      idempotencyKey: "round-key-1",
      answers: [
        { cardId: CARD_A, correct: true },
        { cardId: CARD_FOREIGN, correct: true }, // nicht im Deck
        { cardId: CARD_B, correct: false },
      ],
    });

    // 2 gültige Antworten (A, B), 1 richtig — die fremde Karte zählt nicht.
    expect(recordTestAttempt).toHaveBeenCalledWith(USER, DECK, "round-key-1", 2, 1);
  });

  it("zählt dieselbe Karte nur einmal (kein Aufpumpen des Nenners)", async () => {
    await post({
      idempotencyKey: "round-key-1",
      answers: [
        { cardId: CARD_A, correct: true },
        { cardId: CARD_A, correct: true },
        { cardId: CARD_A, correct: false },
      ],
    });

    expect(recordTestAttempt).toHaveBeenCalledWith(USER, DECK, "round-key-1", 1, 1);
  });

  it("antwortet 422, wenn keine Antwort zu einer Karte des Decks passt", async () => {
    const res = await post({
      idempotencyKey: "round-key-1",
      answers: [{ cardId: CARD_FOREIGN, correct: true }],
    });

    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("NO_VALID_ANSWERS");
    expect(recordTestAttempt).not.toHaveBeenCalled();
  });

  it("lässt genau 2000 Antworten zu, weist 2001 ab (große Prüfung darf durch)", async () => {
    vi.mocked(getDeckCardIds).mockResolvedValue(new Set([CARD_A]));

    const answers2000 = Array.from({ length: 2000 }, () => ({ cardId: CARD_A, correct: true }));
    const ok = await post({ idempotencyKey: "round-key-1", answers: answers2000 });
    // dedupliziert zu 1 gültigen Karte, aber das Schema akzeptiert die 2000.
    expect(ok.status).toBe(201);

    const answers2001 = Array.from({ length: 2001 }, () => ({ cardId: CARD_A, correct: true }));
    const tooMany = await post({ idempotencyKey: "round-key-1", answers: answers2001 });
    expect(tooMany.status).toBe(422);
  });

  it("mappt den Deck-Konflikt (gleicher Schlüssel, anderes Deck) auf 409", async () => {
    vi.mocked(recordTestAttempt).mockRejectedValue(new Error("test_attempt_deck_conflict"));

    const res = await post({ idempotencyKey: "round-key-1", answers: [{ cardId: CARD_A, correct: true }] });

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("IDEMPOTENCY_KEY_CONFLICT");
  });

  it("weist bei überschrittener Bremse ab (429) und schreibt nichts", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const res = await post({ idempotencyKey: "round-key-1", answers: [{ cardId: CARD_A, correct: true }] });

    expect(res.status).toBe(429);
    expect(getDeck).not.toHaveBeenCalled();
    expect(recordTestAttempt).not.toHaveBeenCalled();
  });

  it("gibt bei Erfolg 201 mit den server-gezählten Zahlen zurück", async () => {
    const res = await post({
      idempotencyKey: "round-key-1",
      answers: [
        { cardId: CARD_A, correct: true },
        { cardId: CARD_B, correct: false },
      ],
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ deckId: DECK, questionCount: 2, correctCount: 1 });
  });
});
