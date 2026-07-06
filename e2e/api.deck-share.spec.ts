import { test, expect } from "@playwright/test";
import { apiRequest } from "./helpers";

/**
 * End-to-end check for issue #82: the generated share link must point to a
 * host that actually serves the /deck/[token] page.
 */
test.describe.serial("API Deck Sharing Flow", () => {
  let deckId: string;
  let shareUrl: string;
  let shareToken: string;

  test("create a deck to share", async () => {
    const { status, body } = await apiRequest<{ deck: { id: string } }>("/api/v1/decks", {
      method: "POST",
      body: JSON.stringify({ title: "E2E Share Deck", tags: ["e2e"] }),
    });
    expect(status).toBe(201);
    deckId = body.deck.id;
  });

  test("share the deck returns a resolvable URL", async () => {
    const { status, body } = await apiRequest<{ shareToken: string; shareUrl: string }>(
      `/api/v1/decks/${deckId}/share`,
      { method: "POST" }
    );
    expect(status).toBe(201);
    shareToken = body.shareToken;
    shareUrl = body.shareUrl;

    expect(shareUrl).toContain(`/deck/${shareToken}`);
    // clearn.ai is not registered yet — links must not point there
    expect(shareUrl).not.toContain("clearn.ai");
  });

  test("sharing again returns the same token — old links stay valid", async () => {
    const { status, body } = await apiRequest<{ shareToken: string; shareUrl: string }>(
      `/api/v1/decks/${deckId}/share`,
      { method: "POST" }
    );
    expect(status).toBe(201);
    expect(body.shareToken).toBe(shareToken);
    expect(body.shareUrl).toBe(shareUrl);
  });

  test("shared deck is readable without authentication", async () => {
    const res = await fetch(
      `https://clearn-api.vercel.app/api/v1/decks/share/${shareToken}`
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { deck: { id: string; title: string } };
    expect(body.deck.title).toBe("E2E Share Deck");
  });

  test("the generated share link actually renders a page", async () => {
    const res = await fetch(shareUrl, { redirect: "follow" });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("E2E Share Deck");
  });

  test("cleanup: delete the deck", async () => {
    const { status } = await apiRequest(`/api/v1/decks/${deckId}`, { method: "DELETE" });
    expect(status).toBe(200);
  });
});
