import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { syncOperations } from "@/services/syncService";
import { storeReview } from "@/services/reviewService";
import { HttpError } from "@/lib/http";

vi.mock("@/services/reviewService", () => ({
  storeReview: vi.fn(),
}));

const mockedStoreReview = vi.mocked(storeReview);

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CARD_ID = "3c6cb2b6-d47f-49df-9e7a-1531c9d64dbf";

function reviewOperation(operationId: string) {
  return {
    operationId,
    operationType: "review" as const,
    createdAt: "2026-03-26T20:00:00.000Z",
    payload: {
      userId: USER_ID,
      cardId: CARD_ID,
      rating: "good" as const,
      reviewedAt: "2026-03-26T20:00:00.000Z",
      idempotencyKey: operationId,
    },
  };
}

const storedReview = {
  requestId: "req-sync-ok",
  cardId: CARD_ID,
  nextDueAt: "2026-03-27T10:00:00.000Z",
  stability: 1,
  difficulty: 1,
  state: "review" as const,
};

describe("syncService", () => {
  beforeEach(() => {
    mockedStoreReview.mockReset();
  });

  it("stores review operations with the authenticated user id", async () => {
    mockedStoreReview.mockResolvedValue({
      requestId: "req-sync-1",
      cardId: "3c6cb2b6-d47f-49df-9e7a-1531c9d64dbf",
      nextDueAt: "2026-03-27T10:00:00.000Z",
      stability: 1,
      difficulty: 1,
      state: "review",
    });

    const result = await syncOperations(
      {
        userId: "11111111-1111-4111-8111-111111111111",
        operations: [
          {
            operationId: "review-1",
            operationType: "review",
            createdAt: "2026-03-26T20:00:00.000Z",
            payload: {
              userId: "22222222-2222-4222-8222-222222222222",
              cardId: "3c6cb2b6-d47f-49df-9e7a-1531c9d64dbf",
              rating: "good",
              reviewedAt: "2026-03-26T20:00:00.000Z",
              idempotencyKey: "review-1",
            },
          },
        ],
      },
      "req-sync-1"
    );

    expect(mockedStoreReview).toHaveBeenCalledWith(
      {
        userId: "11111111-1111-4111-8111-111111111111",
        cardId: "3c6cb2b6-d47f-49df-9e7a-1531c9d64dbf",
        rating: "good",
        reviewedAt: "2026-03-26T20:00:00.000Z",
        idempotencyKey: "review-1",
        // Nachzügler aus der Offline-Warteschlange alter App-Builds tragen
        // kein mode — das Schema setzt "flashcard", was für sie stimmt.
        mode: "flashcard",
      },
      "req-sync-1"
    );
    expect(result.acceptedOperationIds).toEqual(["review-1"]);
    expect(result.rejectedOperationIds).toEqual([]);
  });

  it("carries a mode from the offline queue through to storeReview", async () => {
    mockedStoreReview.mockResolvedValue({
      requestId: "req-sync-2",
      cardId: "3c6cb2b6-d47f-49df-9e7a-1531c9d64dbf",
      nextDueAt: "2026-03-27T10:00:00.000Z",
      stability: 1,
      difficulty: 1,
      state: "review",
    });

    await syncOperations(
      {
        userId: "11111111-1111-4111-8111-111111111111",
        operations: [
          {
            operationId: "review-mode-1",
            operationType: "review",
            createdAt: "2026-03-26T20:00:00.000Z",
            payload: {
              userId: "22222222-2222-4222-8222-222222222222",
              cardId: "3c6cb2b6-d47f-49df-9e7a-1531c9d64dbf",
              rating: "again",
              reviewedAt: "2026-03-26T20:00:00.000Z",
              idempotencyKey: "review-mode-1",
              mode: "cloze",
            },
          },
        ],
      },
      "req-sync-2"
    );

    // Ohne dieses Durchreichen wuerde Offline-Lernen im Lueckentext als
    // Karteikarte verbucht — und in Schritt 5/6 falsch bewertet.
    expect(mockedStoreReview).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "cloze" }),
      "req-sync-2"
    );
  });

  it("rejects unsupported sync operation types", async () => {
    const result = await syncOperations(
      {
        userId: "11111111-1111-4111-8111-111111111111",
        operations: [
          {
            operationId: "deck-update-1",
            operationType: "deck_update",
            createdAt: "2026-03-26T20:00:00.000Z",
            payload: {
              deckId: "3c6cb2b6-d47f-49df-9e7a-1531c9d64dbf",
              title: "Neue Deck-Struktur",
            },
          },
        ],
      },
      "req-sync-2"
    );

    expect(mockedStoreReview).not.toHaveBeenCalled();
    expect(result.acceptedOperationIds).toEqual([]);
    expect(result.rejectedOperationIds).toEqual(["deck-update-1"]);
    expect(result.failedOperationIds).toEqual([]);
  });
});

// #418: Ein vorübergehender Aussetzer (Datenbank kurz weg) landete im selben
// Topf wie ein dauerhaft kaputter Eintrag — und der Client löscht diesen Topf.
// Offline gelernte Antworten waren damit still und endgültig weg.
describe("syncService — dauerhaft abgelehnt vs. vorübergehend gescheitert (#418)", () => {
  beforeEach(() => {
    mockedStoreReview.mockReset();
  });

  it("lehnt eine gelöschte Karte ENDGÜLTIG ab (404 -> rejected)", async () => {
    mockedStoreReview.mockRejectedValue(new Error("Card not found"));

    const result = await syncOperations(
      { userId: USER_ID, operations: [reviewOperation("review-gone-1")] },
      "req-sync-gone"
    );

    expect(result.rejectedOperationIds).toEqual(["review-gone-1"]);
    expect(result.failedOperationIds).toEqual([]);
    expect(result.acceptedOperationIds).toEqual([]);
  });

  it("lehnt kaputte Daten ENDGÜLTIG ab (Schema/422 -> rejected)", async () => {
    mockedStoreReview.mockRejectedValue(new ZodError([]));

    const result = await syncOperations(
      { userId: USER_ID, operations: [reviewOperation("review-broken-1")] },
      "req-sync-broken"
    );

    expect(result.rejectedOperationIds).toEqual(["review-broken-1"]);
    expect(result.failedOperationIds).toEqual([]);
  });

  it("lehnt jeden anderen 4xx endgültig ab (HttpError 403 -> rejected)", async () => {
    mockedStoreReview.mockRejectedValue(new HttpError("nope", 403, "FORBIDDEN"));

    const result = await syncOperations(
      { userId: USER_ID, operations: [reviewOperation("review-403-1")] },
      "req-sync-403"
    );

    expect(result.rejectedOperationIds).toEqual(["review-403-1"]);
    expect(result.failedOperationIds).toEqual([]);
  });

  it("hält einen Datenbank-Aussetzer für VORÜBERGEHEND (unbekannt -> failed, nicht rejected)", async () => {
    // Gemischt, damit die Antwort nicht als 503 herausgeht (siehe eigener Test).
    mockedStoreReview
      .mockResolvedValueOnce(storedReview)
      .mockRejectedValueOnce(new Error("createReview: connection terminated"));

    const result = await syncOperations(
      {
        userId: USER_ID,
        operations: [reviewOperation("review-ok-1"), reviewOperation("review-blip-1")],
      },
      "req-sync-blip"
    );

    expect(result.acceptedOperationIds).toEqual(["review-ok-1"]);
    // Der Kern des Fehlers: NICHT abgelehnt — sonst löscht der Client die
    // Antwort und die Lernende hat umsonst gelernt.
    expect(result.rejectedOperationIds).toEqual([]);
    expect(result.failedOperationIds).toEqual(["review-blip-1"]);
  });

  it("hält einen 5xx für VORÜBERGEHEND (HttpError 503 -> failed)", async () => {
    mockedStoreReview
      .mockResolvedValueOnce(storedReview)
      .mockRejectedValueOnce(new HttpError("db down", 503, "UNAVAILABLE"));

    const result = await syncOperations(
      {
        userId: USER_ID,
        operations: [reviewOperation("review-ok-2"), reviewOperation("review-5xx-1")],
      },
      "req-sync-5xx"
    );

    expect(result.acceptedOperationIds).toEqual(["review-ok-2"]);
    expect(result.rejectedOperationIds).toEqual([]);
    expect(result.failedOperationIds).toEqual(["review-5xx-1"]);
  });

  it("teilt eine gemischte Sendung auf drei Töpfe auf", async () => {
    mockedStoreReview
      .mockResolvedValueOnce(storedReview)
      .mockRejectedValueOnce(new Error("Card not found"))
      .mockRejectedValueOnce(new Error("createReview: timeout"));

    const result = await syncOperations(
      {
        userId: USER_ID,
        operations: [
          reviewOperation("review-mix-ok"),
          reviewOperation("review-mix-gone"),
          reviewOperation("review-mix-blip"),
        ],
      },
      "req-sync-mixed"
    );

    expect(result.acceptedOperationIds).toEqual(["review-mix-ok"]);
    expect(result.rejectedOperationIds).toEqual(["review-mix-gone"]);
    expect(result.failedOperationIds).toEqual(["review-mix-blip"]);
  });

  it("lässt den Erfolgsweg unverändert: nichts abgelehnt, nichts gescheitert", async () => {
    mockedStoreReview.mockResolvedValue(storedReview);

    const result = await syncOperations(
      {
        userId: USER_ID,
        operations: [reviewOperation("review-all-ok-1"), reviewOperation("review-all-ok-2")],
      },
      "req-sync-all-ok"
    );

    expect(result.acceptedOperationIds).toEqual(["review-all-ok-1", "review-all-ok-2"]);
    expect(result.rejectedOperationIds).toEqual([]);
    expect(result.failedOperationIds).toEqual([]);
  });

  // Rückwärtskompatibilität: Alte App-Builds kennen failedOperationIds nicht.
  // Scheitert die GANZE Sendung nur vorübergehend, muss der ganze Aufruf mit
  // einem Fehler antworten — dann legen auch sie alles zurück in die
  // Warteschlange (restoreInFlight) statt es hängen zu lassen.
  it("antwortet mit 503 auf die ganze Sendung, wenn ALLES nur vorübergehend scheiterte", async () => {
    mockedStoreReview.mockRejectedValue(new Error("createReview: connection terminated"));

    await expect(
      syncOperations(
        {
          userId: USER_ID,
          operations: [reviewOperation("review-down-1"), reviewOperation("review-down-2")],
        },
        "req-sync-down"
      )
    ).rejects.toMatchObject({ status: 503, code: "SYNC_UNAVAILABLE" });
  });

  it("antwortet NICHT mit 503, sobald etwas angenommen wurde", async () => {
    mockedStoreReview
      .mockResolvedValueOnce(storedReview)
      .mockRejectedValueOnce(new Error("createReview: connection terminated"));

    const result = await syncOperations(
      {
        userId: USER_ID,
        operations: [reviewOperation("review-half-ok"), reviewOperation("review-half-blip")],
      },
      "req-sync-half"
    );

    expect(result.acceptedOperationIds).toEqual(["review-half-ok"]);
    expect(result.failedOperationIds).toEqual(["review-half-blip"]);
  });

  it("antwortet NICHT mit 503, wenn daneben etwas endgültig abgelehnt wurde", async () => {
    // Sonst erführe der Client nie von der endgültigen Ablehnung und der
    // kaputte Eintrag verstopfte die Warteschlange für alles dahinter.
    mockedStoreReview
      .mockRejectedValueOnce(new Error("Card not found"))
      .mockRejectedValueOnce(new Error("createReview: connection terminated"));

    const result = await syncOperations(
      {
        userId: USER_ID,
        operations: [reviewOperation("review-both-gone"), reviewOperation("review-both-blip")],
      },
      "req-sync-both"
    );

    expect(result.rejectedOperationIds).toEqual(["review-both-gone"]);
    expect(result.failedOperationIds).toEqual(["review-both-blip"]);
  });
});
