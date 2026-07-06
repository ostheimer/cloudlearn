import { test, expect } from "@playwright/test";
import { apiRequest } from "./helpers";

/**
 * End-to-end check for issue #99: a shared deck can be imported into the
 * caller's library as an INDEPENDENT copy. The copy carries the cards but
 * fresh learning progress, and editing the copy must not change the original.
 */
test.describe.serial("API Deck Import Flow", () => {
  let originalDeckId: string;
  let importedDeckId: string;
  let shareToken: string;

  test("create an original deck with a card and share it", async () => {
    const deck = await apiRequest<{ deck: { id: string } }>("/api/v1/decks", {
      method: "POST",
      body: JSON.stringify({ title: "E2E Import Original", tags: ["e2e"] }),
    });
    expect(deck.status).toBe(201);
    originalDeckId = deck.body.deck.id;

    const card = await apiRequest("/api/v1/cards", {
      method: "POST",
      body: JSON.stringify({
        deckId: originalDeckId,
        card: { front: "Hauptstadt von Österreich?", back: "Wien", type: "basic", difficulty: "easy", tags: [] },
      }),
    });
    expect(card.status).toBe(201);

    const share = await apiRequest<{ shareToken: string }>(
      `/api/v1/decks/${originalDeckId}/share`,
      { method: "POST" }
    );
    expect(share.status).toBe(201);
    shareToken = share.body.shareToken;
  });

  test("import creates a new, independent deck with the cards", async () => {
    const { status, body } = await apiRequest<{ deck: { id: string; title: string } }>(
      `/api/v1/decks/share/${shareToken}/import`,
      { method: "POST" }
    );
    expect(status).toBe(201);
    importedDeckId = body.deck.id;

    // A genuinely new deck, not the original
    expect(importedDeckId).not.toBe(originalDeckId);
    expect(body.deck.title).toBe("E2E Import Original");

    // The copy carries the cards
    const cards = await apiRequest<{ cards: Array<{ front: string }> }>(
      `/api/v1/decks/${importedDeckId}/cards`
    );
    expect(cards.status).toBe(200);
    expect(cards.body.cards.some((c) => c.front === "Hauptstadt von Österreich?")).toBe(true);
  });

  test("editing the copy leaves the original untouched", async () => {
    const rename = await apiRequest(`/api/v1/decks/${importedDeckId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "Meine bearbeitete Kopie" }),
    });
    expect(rename.status).toBe(200);

    const original = await apiRequest<{ details: { title: string } }>(
      `/api/v1/decks/${originalDeckId}/details`
    );
    expect(original.status).toBe(200);
    expect(original.body.details.title).toBe("E2E Import Original");
  });

  test("importing an unknown token returns 404", async () => {
    const { status } = await apiRequest(
      "/api/v1/decks/share/00000000-0000-0000-0000-000000000000/import",
      { method: "POST" }
    );
    expect(status).toBe(404);
  });

  test("cleanup: delete both decks", async () => {
    const a = await apiRequest(`/api/v1/decks/${importedDeckId}`, { method: "DELETE" });
    const b = await apiRequest(`/api/v1/decks/${originalDeckId}`, { method: "DELETE" });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
  });
});
