import { expect, test } from "@playwright/test";
import { apiRequest } from "./helpers";

test.describe("@paid API URL Import", () => {
  let deckId: string;

  test("imports URL content and stores generated cards", async () => {
    const createDeck = await apiRequest<{ deck: { id: string } }>("/api/v1/decks", {
      method: "POST",
      body: JSON.stringify({ title: "E2E URL Import Deck", tags: ["e2e", "url"] }),
    });
    expect(createDeck.status).toBe(201);
    deckId = createDeck.body.deck.id;

    const importRes = await apiRequest<{
      sourceUrl: string;
      imagesUsed: number;
      cards: Array<{ front: string; back: string }>;
      model: string;
    }>("/api/v1/import/url", {
      method: "POST",
      body: JSON.stringify({
        sourceUrl: "https://example.com/",
        idempotencyKey: `e2e-url-${Date.now()}`,
        sourceLanguage: "de",
        maxImages: 2,
        deckId,
      }),
    });

    if (importRes.status === 405) {
      await apiRequest<{ deleted: boolean }>(`/api/v1/decks/${deckId}`, {
        method: "DELETE",
      });
      test.skip(true, "URL import endpoint ist auf der Zielumgebung noch nicht ausgerollt.");
    }

    if (importRes.status === 402) {
      await apiRequest<{ deleted: boolean }>(`/api/v1/decks/${deckId}`, {
        method: "DELETE",
      });
      test.skip(true, "URL import needs LP balance on the shared live E2E user.");
    }

    expect(importRes.status).toBe(200);
    expect(importRes.body.sourceUrl).toBe("https://example.com/");
    expect(importRes.body.cards.length).toBeGreaterThan(0);
    expect(importRes.body.imagesUsed).toBeGreaterThanOrEqual(0);
    expect(typeof importRes.body.model).toBe("string");

    const cardsInDeck = await apiRequest<{ cards: Array<{ id: string }> }>(
      `/api/v1/decks/${deckId}/cards`
    );
    expect(cardsInDeck.status).toBe(200);
    expect(cardsInDeck.body.cards.length).toBeGreaterThan(0);

    const cleanup = await apiRequest<{ deleted: boolean }>(`/api/v1/decks/${deckId}`, {
      method: "DELETE",
    });
    expect(cleanup.status).toBe(200);
    expect(cleanup.body.deleted).toBe(true);
  });
});
