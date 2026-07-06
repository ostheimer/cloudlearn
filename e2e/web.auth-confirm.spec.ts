import { test, expect } from "@playwright/test";

/**
 * Issue #88: /auth/confirm must reflect the actual Supabase result
 * instead of always claiming success, and the CTA must be a real link.
 */
test.describe("Auth Confirm Page (/auth/confirm)", () => {
  test("shows success with a clickable app link when no error is present", async ({ page }) => {
    await page.goto("/auth/confirm");
    await expect(page.getByRole("heading", { name: "E-Mail bestätigt!" })).toBeVisible();

    const appLink = page.locator('a[href^="clearn://"]');
    await expect(appLink).toBeVisible();
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
