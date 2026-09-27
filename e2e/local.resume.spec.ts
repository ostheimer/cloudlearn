import { test, expect, type Page } from "@playwright/test";

const deckId = "10000000-0000-4000-8000-000000000001";
const userId = "20000000-0000-4000-8000-000000000001";
const cardIds = Array.from({ length: 8 }, (_, i) => `30000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`);
type Mode = "flashcards" | "cloze";

async function prepare(page: Page, mode: Mode, { exhausted = false, source = "due", answeredCurrent = false }: { exhausted?: boolean; source?: "due" | "all"; answeredCurrent?: boolean } = {}) {
  const reviews: string[] = [];
  const awards: number[] = [];
  const unexpected: string[] = [];
  const errors: string[] = [];
  let deleted = false;
  page.on("pageerror", (error) => errors.push(error.message));
  const cards = (source === "all" ? cardIds.slice(0, 7) : cardIds).map((id, i) => ({
    id, userId, deckId, front: `Frage ${i + 1}`, back: `Antwort ${i + 1}`,
    type: "basic", difficulty: "medium", tags: [], starred: false,
    fsrsDue: exhausted || i < 2 ? "2099-01-01T00:00:00Z" : "2020-01-01T00:00:00Z",
    fsrsState: "review",
  }));
  const progress = {
    index: exhausted ? 6 : 2, cardId: cardIds[exhausted ? 6 : 2], source,
    reverse: false, total: 7, cardIds: cardIds.slice(0, 7),
    results: Object.fromEntries(cardIds.slice(0, exhausted ? 7 : answeredCurrent ? 3 : 2).map((id, i) => [id, { correct: i !== 1, overridden: false }])),
    updatedAt: new Date().toISOString(),
  };
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = (body: unknown) => route.fulfill({ json: body });
    if (path.startsWith("/api/v1/")) {
      if (path === `/api/v1/decks/${deckId}/cards`) return json({ cards });
      if (path === "/api/v1/learn/progress") {
        if (request.method() === "DELETE") { deleted = true; return json({ cleared: true }); }
        if (request.method() === "PUT") return json({ saved: true });
        return json({ progress: deleted ? null : progress });
      }
      if (path.endsWith("/review")) {
        const body = request.postDataJSON() as { cardId: string };
        reviews.push(body.cardId);
        return json({ cardId: body.cardId, nextDueAt: "2099-01-01T00:00:00Z", state: "review" });
      }
      if (path === "/api/v1/lp/earn") {
        awards.push((request.postDataJSON() as { sessionCardCount: number }).sessionCardCount);
        return json({ granted: 1, newBalance: 11, capReached: false });
      }
      if (path === "/api/v1/account/profile") return json({ displayName: "Testperson", gender: null });
      if (path === "/api/v1/usage") return json({ tier: "free", lpBalance: 10 });
      if (path === "/api/v1/stats") return json({ stats: { dailyGoal: 20, reviewsToday: 7 } });
      if (path === `/api/v1/decks/${deckId}/details`) return json({ details: { title: "Lokaler Test", speechLangFront: "de", speechLangBack: "de" } });
      unexpected.push(`${request.method()} ${path}`);
      return json({});
    }
    if (url.origin === "http://127.0.0.1:4175") return route.continue();
    unexpected.push(url.origin + path);
    return route.abort();
  });
  await page.addInitScript(({ userId, deckId, mode, source }) => {
    localStorage.setItem("clearn_onboarding_completed", "true");
    localStorage.setItem(`clearn:setup:${mode}:${deckId}`, JSON.stringify({ source }));
    localStorage.setItem("sb-127-auth-token", JSON.stringify({
      access_token: "local-test-token", refresh_token: "local-test-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: "bearer",
      user: { id: userId, email: "learner@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} },
    }));
  }, { userId, deckId, mode, source });
  return { reviews, awards, unexpected, errors, wasDeleted: () => deleted };
}

for (const mode of ["flashcards", "cloze"] as const) {
  test(`${mode}: resumes the original due queue and counts only new reviews for LP`, async ({ page }) => {
    const recorded = await prepare(page, mode);
    await page.goto(`/dashboard/deck/${deckId}/${mode === "flashcards" ? "learn" : "cloze"}`);
    const resume = page.getByRole("button", { name: /Weitermachen/ });
    await expect(resume).toContainText("Karte 3 von 7");
    await resume.click();
    for (let n = 3; n <= 7; n += 1) {
      await expect(page.getByText(`Frage ${n}`, { exact: true })).toBeVisible();
      if (mode === "flashcards") {
        await page.getByRole("button", { name: "Karte umdrehen", exact: true }).click();
        await page.keyboard.press("3");
      } else {
        await page.getByPlaceholder("Antwort eintippen…").fill(`Antwort ${n}`);
        await page.getByRole("button", { name: "Prüfen", exact: true }).click();
        await page.getByRole("button", { name: n === 7 ? "Zur Auswertung" : "Weiter", exact: true }).click();
      }
    }
    await expect(page.getByText(mode === "flashcards" ? /Du hast 7 Karten wiederholt/ : "6 von 7 richtig")).toBeVisible();
    await expect(page.getByRole("button", { name: "Nur die nicht gewussten (1)", exact: true })).toBeVisible();
    await expect.poll(() => recorded.reviews).toEqual(cardIds.slice(2, 7));
    await expect.poll(() => recorded.awards).toEqual([5]);
    await expect.poll(recorded.wasDeleted).toBe(true);
    expect(recorded.errors).toEqual([]);
    expect(recorded.unexpected).toEqual([]);
    await page.screenshot({ path: `test-results/resume-${mode}.png`, fullPage: true });
  });
}

test("cloze: already answered final card opens the summary even with zero due cards", async ({ page }) => {
  const recorded = await prepare(page, "cloze", { exhausted: true });
  await page.goto(`/dashboard/deck/${deckId}/cloze`);
  const resume = page.getByRole("button", { name: /Weitermachen/ });
  await expect(resume).toContainText("Runde abgeschlossen");
  await resume.click();
  await expect(page.getByRole("button", { name: "Nur die nicht gewussten (1)", exact: true })).toBeVisible();
  await expect.poll(recorded.wasDeleted).toBe(true);
  expect(recorded.reviews).toEqual([]);
  expect(recorded.awards).toEqual([]);
  expect(recorded.errors).toEqual([]);
  expect(recorded.unexpected).toEqual([]);
});

test("all-card cloze resumes after the already submitted visible answer", async ({ page }) => {
  const recorded = await prepare(page, "cloze", { source: "all", answeredCurrent: true });
  await page.goto(`/dashboard/deck/${deckId}/cloze`);
  const resume = page.getByRole("button", { name: /Weitermachen/ });
  await expect(resume).toContainText("Karte 4 von 7");
  await resume.click();
  for (let n = 4; n <= 7; n += 1) {
    await expect(page.getByText(`Frage ${n}`, { exact: true })).toBeVisible();
    await page.getByPlaceholder("Antwort eintippen…").fill(`Antwort ${n}`);
    await page.getByRole("button", { name: "Prüfen", exact: true }).click();
    await page.getByRole("button", { name: n === 7 ? "Zur Auswertung" : "Weiter", exact: true }).click();
  }
  await expect(page.getByText("6 von 7 richtig")).toBeVisible();
  await expect.poll(() => recorded.reviews).toEqual(cardIds.slice(3, 7));
  await expect.poll(() => recorded.awards).toEqual([4]);
  await expect.poll(recorded.wasDeleted).toBe(true);
  expect(recorded.errors).toEqual([]);
  expect(recorded.unexpected).toEqual([]);
});
