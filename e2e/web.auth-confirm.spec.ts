import { test, expect } from "@playwright/test";

/**
 * Issue #88: /auth/confirm must reflect the actual Supabase result
 * instead of always claiming success, and the CTA must be a real link.
 */
test.describe("Auth Confirm Page (/auth/confirm)", () => {
  test("desktop: shows success with a hand-off hint instead of a dead app link", async ({
    page,
  }) => {
    await page.goto("/auth/confirm");
    await expect(page.getByRole("heading", { name: "E-Mail bestätigt!" })).toBeVisible();

    // clearn:// does nothing on desktop browsers — no misleading button
    await expect(page.getByText("Weiter geht’s am Handy")).toBeVisible();
    await expect(page.locator('a[href^="clearn://"]')).toHaveCount(0);
  });

  test.describe("mobile", () => {
    test.use({
      viewport: { width: 375, height: 812 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });

    test("shows success with a real clearn:// app link", async ({ page }) => {
      await page.goto("/auth/confirm");
      await expect(page.getByRole("heading", { name: "E-Mail bestätigt!" })).toBeVisible();
      await expect(page.locator('a[href^="clearn://"]')).toBeVisible();
    });
  });

  test("shows an error state when the confirmation link expired", async ({ page }) => {
    await page.goto(
      "/auth/confirm#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"
    );

    await expect(page.getByRole("heading", { name: /abgelaufen/ })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("E-Mail bestätigt!");
  });

  test("shows a generic error state for other auth errors", async ({ page }) => {
    await page.goto("/auth/confirm?error=server_error&error_description=Something+went+wrong");

    await expect(page.getByRole("heading", { name: /nicht geklappt/ })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("E-Mail bestätigt!");
  });
});
