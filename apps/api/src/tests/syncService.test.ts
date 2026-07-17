import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncOperations } from "@/services/syncService";
import { storeReview } from "@/services/reviewService";

vi.mock("@/services/reviewService", () => ({
  storeReview: vi.fn(),
}));

const mockedStoreReview = vi.mocked(storeReview);

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
  });
});
