import { test, expect, type Page } from "@playwright/test";

const deckId = "10000000-0000-4000-8000-000000000730";
const userId = "20000000-0000-4000-8000-000000000730";
const image = (side: string, n: number) => `https://images.example.test/${side}-${n}.svg`;

async function prepare(page: Page, english: boolean, setup: Record<string, unknown> = {}) {
  const reviews: Record<string, unknown>[] = [];
  const unexpected: string[] = [];
  const errors: string[] = [];
  const cards = Array.from({ length: 4 }, (_, i) => ({
    id: `30000000-0000-4000-8000-00000000073${i}`, deckId, userId,
    front: `${english ? "Shape" : "Form"} ${i + 1} ![](${image("front", i)})`,
    back: `${english ? "Answer" : "Antwort"} ${i + 1} ![](${image("back", i)})`,
    type: "basic", difficulty: "medium", tags: [], starred: false,
    fsrsDue: "2020-01-01T00:00:00Z", fsrsState: "review",
  }));
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const json = (body: unknown) => route.fulfill({ json: body });
    if (url.hostname === "images.example.test") return route.fulfill({ contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" rx="20" fill="${path.includes("front") ? "#dbeafe" : "#dcfce7"}"/><circle cx="160" cy="90" r="${40 + Number(path.match(/\d/)?.[0] ?? 0) * 8}" fill="#2563eb"/></svg>` });
    if (path.startsWith("/api/v1/")) {
      if (path === `/api/v1/decks/${deckId}/cards`) return json({ cards: [...cards, { ...cards[0], id: "occlusion", type: "occlusion", back: "Region" }] });
      if (path.endsWith("/review")) { reviews.push(request.postDataJSON()); return json({ state: "review", nextDueAt: "2099-01-01T00:00:00Z" }); }
      if (path === "/api/v1/account/profile") return json({ displayName: "Testperson" });
      if (path === "/api/v1/usage") return json({ tier: "free", lpBalance: 10 });
      if (path === "/api/v1/lp/earn") return json({ granted: 1, capReached: false });
      if (path === "/api/v1/stats") return json({ stats: { dailyGoal: 20, reviewsToday: reviews.length } });
      unexpected.push(`${request.method()} ${path}`); return json({});
    }
    if (url.origin === "http://127.0.0.1:4189") return route.continue();
    unexpected.push(request.url()); return route.abort();
  });
  await page.addInitScript(({ userId, deckId, setup }) => {
    localStorage.setItem("clearn_onboarding_completed", "true");
    if (!localStorage.getItem(`clearn:setup:quiz:${deckId}`)) localStorage.setItem(`clearn:setup:quiz:${deckId}`, JSON.stringify({ source: "all", typeMC: true, typeTF: false, typeImage: false, ...setup }));
    localStorage.setItem("sb-127-auth-token", JSON.stringify({ access_token: "synthetic-token", refresh_token: "synthetic-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: "bearer", user: { id: userId, email: "learner@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } }));
  }, { userId, deckId, setup });
  return { cards, reviews, unexpected, errors };
}

async function screenshot(page: Page, name: string, project: string) {
  await expect.poll(() => page.locator(".card-side-media img").evaluateAll(imgs => imgs.every(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/card-media/${project}-${name}.png`, fullPage: true });
}

test("quiz renders front/option images, preserves settings and records reviews", async ({ page }, info) => {
  const fixture = await prepare(page, info.project.name.endsWith("en"));
  await page.goto(`/dashboard/deck/${deckId}/quiz`);
  await page.getByRole("button", { name: "Starten", exact: true }).click();
  await expect(page.locator(".cl-q img")).toHaveCount(1);
  await expect(page.locator(".quiz-opt img")).toHaveCount(4);
  expect(await page.locator(".cl-q img").getAttribute("src")).toContain("/front-");
  for (const src of await page.locator(".quiz-opt img").evaluateAll(imgs => imgs.map(i => i.getAttribute("src")))) expect(src).toContain("/back-");
  await screenshot(page, "quiz", info.project.name);
  for (let i = 0; i < 4; i++) {
    await page.locator(".quiz-opt").first().click();
    await page.getByRole("button", { name: i === 3 ? "Ergebnis" : "Weiter", exact: true }).click();
  }
  await expect.poll(() => fixture.reviews.length).toBe(4);
  expect(fixture.reviews.every(r => r.mode === "quiz")).toBe(true);
  expect(fixture.reviews.map(r => r.cardId)).not.toContain("occlusion");
  await page.reload();
  await expect(page.getByRole("switch", { name: "Bildfragen", exact: true })).toHaveAttribute("aria-checked", "false");
  expect(fixture.errors).toEqual([]); expect(fixture.unexpected).toEqual([]);
});

test("image-only quiz type uses the image as its question", async ({ page }, info) => {
  const fixture = await prepare(page, info.project.name.endsWith("en"), { typeMC: false, typeTF: false, typeImage: true });
  await page.goto(`/dashboard/deck/${deckId}/quiz`);
  await page.getByRole("button", { name: "Starten", exact: true }).click();
  await expect(page.getByText("BILD QUIZ", { exact: true })).toBeVisible();
  await expect(page.locator(".cl-q")).toContainText("Welches Element zeigt das Bild?");
  await expect(page.locator(".cl-q")).not.toContainText(/Form|Shape|Antwort|Answer/);
  await expect(page.locator(".cl-q img")).toHaveAttribute("alt", "Fragebild 1");
  await screenshot(page, "image-quiz", info.project.name);
  expect(fixture.errors).toEqual([]); expect(fixture.unexpected).toEqual([]);
});

test("match renders both sides and keeps occlusion out of its tiles", async ({ page }, info) => {
  const fixture = await prepare(page, info.project.name.endsWith("en"));
  await page.goto(`/dashboard/deck/${deckId}/match`);
  await page.getByRole("button", { name: /Starten/ }).click();
  await expect(page.locator(".zu-tile img")).toHaveCount(8);
  await expect(page.locator(".zu-grid")).not.toContainText("Region");
  await screenshot(page, "match", info.project.name);
  for (let n = 0; n < 4; n++) {
    await page.locator(".zu-tile").filter({ has: page.locator(`img[src="${image("front", n)}"]`) }).click();
    await page.locator(".zu-tile").filter({ has: page.locator(`img[src="${image("back", n)}"]`) }).click();
  }
  await expect.poll(() => fixture.reviews.length).toBe(4);
  expect(fixture.errors).toEqual([]); expect(fixture.unexpected).toEqual([]);
});
