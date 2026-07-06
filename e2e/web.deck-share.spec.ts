import { test, expect } from "@playwright/test";

test.describe("Shared Deck Page (/deck/[token])", () => {
  test("unknown token shows a friendly 404 page", async ({ page }) => {
    const res = await page.goto("/deck/00000000-0000-0000-0000-000000000000");
    expect(res?.status()).toBe(404);

    const body = await page.textContent("body");
    expect(body).toContain("ungültig oder abgelaufen");
    // The branded frame should still be visible, not a bare error page
    expect(body).toContain("clearn");
  });
});
