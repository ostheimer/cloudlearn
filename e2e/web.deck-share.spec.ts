import { test, expect } from "@playwright/test";
import { apiRequest } from "./helpers";

test.describe("Shared Deck Page (/deck/[token])", () => {
  test("unknown token shows a friendly 404 page", async ({ page }) => {
    const res = await page.goto("/deck/00000000-0000-0000-0000-000000000000");
    expect(res?.status()).toBe(404);

    const body = await page.textContent("body");
    expect(body).toContain("ungültig oder abgelaufen");
    // The branded frame should still be visible, not a bare error page
    expect(body).toContain("clearn");
  });

  test("long deck titles fit the mobile viewport without horizontal overflow", async ({
    page,
  }) => {
    // Long single words used to blow the layout open (issue seen with
    // "Waidmannssprache: Der Feldhase" on iPhone)
    const { status, body } = await apiRequest<{ deck: { id: string } }>("/api/v1/decks", {
      method: "POST",
      body: JSON.stringify({ title: "Waidmannssprache: Superlanges Beispielwort", tags: ["e2e"] }),
    });
    expect(status).toBe(201);
    const deckId = body.deck.id;

    try {
      const share = await apiRequest<{ shareUrl: string }>(`/api/v1/decks/${deckId}/share`, {
        method: "POST",
      });
      expect(share.status).toBe(201);

      await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
      await page.goto(share.body.shareUrl);
      await expect(page.locator("h1")).toContainText("Waidmannssprache");

      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(375 + 10); // small tolerance
    } finally {
      await apiRequest(`/api/v1/decks/${deckId}`, { method: "DELETE" });
    }
  });

  test.describe("mobile", () => {
    test.use({
      viewport: { width: 375, height: 812 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });

    test("offers an 'übernehmen' deep link into the app (#99)", async ({ page }) => {
      const { status, body } = await apiRequest<{ deck: { id: string } }>("/api/v1/decks", {
        method: "POST",
        body: JSON.stringify({ title: "E2E Import Web Deck", tags: ["e2e"] }),
      });
      expect(status).toBe(201);
      const deckId = body.deck.id;

      try {
        const share = await apiRequest<{ shareToken: string; shareUrl: string }>(
          `/api/v1/decks/${deckId}/share`,
          { method: "POST" }
        );
        // Use the relative path so the configured baseURL is exercised
        await page.goto(`/deck/${share.body.shareToken}`);

        const deepLink = page.locator(`a[href="clearn://deck/share/${share.body.shareToken}"]`);
        await expect(deepLink).toBeVisible();
        await expect(deepLink).toContainText("übernehmen");
      } finally {
        await apiRequest(`/api/v1/decks/${deckId}`, { method: "DELETE" });
      }
    });
  });
});
