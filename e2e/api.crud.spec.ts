import { test, expect } from "@playwright/test";
import { apiRequest } from "./helpers";

test.describe("API CRUD Flow", () => {
  let deckId: string;
  let cardId: string;

  test("create a deck", async () => {
    const { status, body } = await apiRequest<{ deck: { id: string; title: string } }>(
      "/api/v1/decks",
      {
        method: "POST",
        body: JSON.stringify({ title: "E2E Test Deck", tags: ["e2e"] }),
      }
    );
    expect(status).toBe(201);
    expect(body.deck.title).toBe("E2E Test Deck");
    deckId = body.deck.id;
  });

  test("create a card in the deck", async () => {
    const { status, body } = await apiRequest<{ card: { id: string; front: string; starred: boolean } }>(
      "/api/v1/cards",
      {
        method: "POST",
        body: JSON.stringify({
          deckId,
          card: {
            front: "Was ist Playwright?",
            back: "Ein E2E-Testing-Framework",
            type: "basic",
            difficulty: "medium",
            tags: ["e2e"],
          },
        }),
      }
    );
    expect(status).toBe(201);
    expect(body.card.front).toBe("Was ist Playwright?");
    expect(body.card.starred).toBe(false);
    cardId = body.card.id;
  });

  test("toggle card starred", async () => {
    const { status, body } = await apiRequest<{ card: { starred: boolean } }>(
      `/api/v1/cards/${cardId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ starred: true }),
      }
    );
    expect(status).toBe(200);
    expect(body.card.starred).toBe(true);
  });

  test("get due cards includes the new card", async () => {
    const { status, body } = await apiRequest<{ cards: Array<{ id: string; starred: boolean }> }>(
      "/api/v1/learn/due"
    );
    expect(status).toBe(200);
    const card = body.cards.find((c) => c.id === cardId);
    expect(card).toBeTruthy();
    expect(card!.starred).toBe(true);
  });

  test("review the card", async () => {
    const { status, body } = await apiRequest<{ state: string; nextDueAt: string }>(
      `/api/v1/cards/${cardId}/review`,
      {
        method: "POST",
        body: JSON.stringify({
          rating: "good",
          reviewedAt: new Date().toISOString(),
          idempotencyKey: `e2e-${Date.now()}`,
        }),
      }
    );
    expect(status).toBe(201);
    expect(body.state).toBe("learning");
    expect(body.nextDueAt).toBeTruthy();
  });

  test("stats reflect the review", async () => {
    const { status, body } = await apiRequest<{ stats: { reviewsTotal: number; currentStreak: number } }>(
      "/api/v1/stats"
    );
    expect(status).toBe(200);
    expect(body.stats.reviewsTotal).toBeGreaterThanOrEqual(1);
    expect(body.stats.currentStreak).toBeGreaterThanOrEqual(1);
  });

  test("list cards in deck", async () => {
    const { status, body } = await apiRequest<{ cards: Array<{ id: string }> }>(
      `/api/v1/decks/${deckId}/cards`
    );
    expect(status).toBe(200);
    expect(body.cards.length).toBeGreaterThanOrEqual(1);
  });

  test("cleanup: delete the deck", async () => {
    const { status, body } = await apiRequest<{ deleted: boolean }>(
      `/api/v1/decks/${deckId}`,
      { method: "DELETE" }
    );
    expect(status).toBe(200);
    expect(body.deleted).toBe(true);
  });
});
