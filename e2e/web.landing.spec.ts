import { test, expect } from "@playwright/test";

test.describe("Web Landing Page", () => {
  test("homepage loads successfully", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    await page.waitForLoadState("networkidle");

    // Page should have visible content (heading or text)
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(10);
  });

  test("homepage is responsive (mobile viewport)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Page should not have horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375 + 10); // small tolerance
  });

  test("page loads in under 3 seconds", async ({ page }) => {
    const start = Date.now();
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(3000);
  });
});
