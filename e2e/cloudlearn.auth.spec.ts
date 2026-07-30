import { expect, test, type Page } from "@playwright/test";

const forbiddenConsoleFragments = [
  "password field is not contained in a form",
  "cannot read properties of undefined",
  "minified react error",
];

function collectConsoleIssues(page: Page) {
  const messages: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") {
      return;
    }
    messages.push(message.text());
  });

  page.on("pageerror", (error) => {
    messages.push(error.message);
  });

  return messages;
}

async function openAuthFromGuestHome(page: Page) {
  const authTitle = page.getByText("Willkommen zurück");
  const tagline = page.getByText("Foto — Flashcards — Wissen").first();
  if (await authTitle.isVisible({ timeout: 1000 }).catch(() => false)) {
    return;
  }

  // #609: Die Gast-Startseite hieß „Ohne Konto starten" und verlangte dann
  // doch überall ein Konto. Jetzt steht dort zuerst das, was ohne Konto
  // wirklich geht, und darunter erst die Anmelde-Karte.
  await expect(page.getByText("Erst mal ausprobieren")).toBeVisible();
  await expect(page.getByText("Beispielkarten lernen")).toBeVisible();
  await expect(page.getByText("Mit Konto geht mehr")).toBeVisible();
  await expect(tagline).toBeVisible();

  await page.getByText("Anmelden oder registrieren").first().click();
  await expect(authTitle).toBeVisible();
}

test.describe("cloudlearn auth preview", () => {
  test("desktop auth screen renders without bootstrap errors", async ({ page }) => {
    const issues = collectConsoleIssues(page);
    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    await page.waitForLoadState("networkidle");
    await openAuthFromGuestHome(page);
    await expect(page.getByText("Willkommen zurück")).toBeVisible();
    await expect(page.getByRole("button", { name: "Anmelden" })).toBeVisible();

    for (const fragment of forbiddenConsoleFragments) {
      expect(
        issues.some((message) => message.toLowerCase().includes(fragment))
      ).toBeFalsy();
    }
    expect(issues).toEqual([]);
  });

  test("mobile auth screen stays within viewport and submits via Enter", async ({ page }) => {
    const issues = collectConsoleIssues(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await openAuthFromGuestHome(page);
    const submitRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.url().includes("/auth/v1/token")
    );
    // Platzhalter seit #571 wortgleich mit dem Web (vorher „deine@email.de").
    await page.getByPlaceholder("du@beispiel.de").fill("test@example.com");
    await page.getByPlaceholder("••••••••").fill("secret123");
    await page.getByPlaceholder("••••••••").press("Enter");
    await submitRequest;

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(400);

    for (const fragment of forbiddenConsoleFragments) {
      expect(
        issues.some((message) => message.toLowerCase().includes(fragment))
      ).toBeFalsy();
    }
  });
});
