import { test, expect, type Page } from "@playwright/test";

const deckId = "10000000-0000-4000-8000-000000000001";
const userId = "20000000-0000-4000-8000-000000000001";
const folderId = "40000000-0000-4000-8000-000000000001";
const deck = { id: deckId, userId, title: "Lokale Tastaturprüfung", tags: [], cardCount: 3, createdAt: "2026-01-01", updatedAt: "2026-01-01" };

async function prepare(page: Page) {
  const reviews: string[] = [], errors: string[] = [], unexpected: string[] = [];
  const cards = Array.from({ length: 3 }, (_, i) => ({
    id: `30000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, userId, deckId,
    front: `Frage ${i + 1}`, back: `Antwort ${i + 1}`, type: "basic", difficulty: "medium",
    tags: [], starred: false, fsrsDue: "2020-01-01T00:00:00Z", fsrsState: "review",
  }));
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const json = (body: unknown) => route.fulfill({ json: body });
    if (path.startsWith("/api/v1/")) {
      if (path === "/api/v1/decks" || path.endsWith("/decks") && path.startsWith("/api/v1/folders/")) return json({ decks: url.searchParams.has("archived") ? [] : [deck] });
      if (path === `/api/v1/decks/${deckId}/cards` || path === "/api/v1/learn/due") return json({ cards });
      if (path === `/api/v1/decks/${deckId}/details`) return json({ details: { ...deck, speechLangFront: "de", speechLangBack: "de" } });
      if (path === `/api/v1/decks/${deckId}/stats`) return json({ wobblyCards: [] });
      if (path === "/api/v1/learn/progress") return json(request.method() === "GET" ? { progress: null } : { saved: true, cleared: true });
      if (path.endsWith("/review")) { reviews.push(request.postDataJSON().cardId); return json({ nextDueAt: "2099-01-01T00:00:00Z", state: "review" }); }
      if (path.startsWith("/api/v1/cards/") && request.method() === "PATCH") {
        const card = cards.find(c => path.endsWith(c.id)); Object.assign(card ?? {}, request.postDataJSON()); return json({ card });
      }
      if (path === "/api/v1/account/profile") return json({ displayName: "Testperson", gender: null });
      if (path === "/api/v1/usage") return json({ tier: "pro", lpBalance: 500, limits: { maxDecks: 100, maxCardsPerDeck: 500 } });
      if (path === "/api/v1/lp/earn") return json({ granted: 1, newBalance: 501, capReached: false });
      if (path === "/api/v1/stats") return json({ stats: { dailyGoal: 20, reviewsToday: reviews.length, dueCards: 3, totalDecks: 1, currentStreak: 1, longestStreak: 1, accuracyRate: 1 } });
      if (path === "/api/v1/stats/due-by-deck") return json({ dueByDeck: { [deckId]: 3 } });
      if (path === "/api/v1/stats/last-learned-by-deck") return json({ lastLearnedByDeck: {} });
      if (path === "/api/v1/stats/decks-by-folder") return json({ decksByFolder: {} });
      if (path === "/api/v1/friends/streaks") return json({ streaks: [] });
      if (path === "/api/v1/folders") return json({ folders: [
        { id: folderId, userId, title: "Hauptordner", parentId: null, description: "" },
        { id: "40000000-0000-4000-8000-000000000002", userId, title: "Unterordner", parentId: folderId, description: "" },
      ] });
      unexpected.push(`${request.method()} ${path}`); return json({});
    }
    if (url.origin === "http://127.0.0.1:4193") return route.continue();
    unexpected.push(url.origin + path); return route.abort();
  });
  await page.addInitScript(({ userId }) => {
    localStorage.setItem("clearn_onboarding_completed", "true");
    localStorage.setItem("sb-127-auth-token", JSON.stringify({
      access_token: "local-test-token", refresh_token: "local-test-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600, token_type: "bearer", user: { id: userId, email: "learner@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} },
    }));
  }, { userId });
  return { reviews, errors, unexpected };
}

async function start(page: Page, mode = "learn") {
  await page.goto(`/dashboard/deck/${deckId}/${mode}`);
  await page.getByRole("button", { name: "Starten", exact: true }).click();
  await expect(page.getByText("Frage 1", { exact: true }).first()).toBeVisible();
}

async function clean(record: Awaited<ReturnType<typeof prepare>>, page: Page) {
  expect(record.errors).toEqual([]); expect(record.unexpected).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

test("open flashcard editor blocks all four rating shortcuts", async ({ page }) => {
  const record = await prepare(page); await start(page);
  await page.getByRole("button", { name: "Karte umdrehen", exact: true }).click();
  await page.getByRole("button", { name: "Karte bearbeiten", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Karte bearbeiten", exact: true });
  await editor.getByRole("button", { name: "Schwer", exact: true }).focus();
  for (const key of ["1", "2", "3", "4"]) { await page.keyboard.press(key); await page.waitForTimeout(200); }
  await expect(page.locator(".study-card")).toContainText("Frage 1");
  expect(record.reviews).toEqual([]); await clean(record, page);
});

test("dialog container also blocks rating shortcuts", async ({ page }) => {
  const record = await prepare(page); await start(page);
  await page.getByRole("button", { name: "Karte umdrehen", exact: true }).click();
  await page.getByRole("button", { name: "Karte bearbeiten", exact: true }).click();
  await page.getByRole("dialog", { name: "Karte bearbeiten", exact: true }).focus();
  await page.keyboard.press("3"); await page.waitForTimeout(200);
  await expect(page.locator(".study-card")).toContainText("Frage 1"); await clean(record, page);
});

test("open cloze editor preserves Enter/newline and the reviewed card", async ({ page }) => {
  const record = await prepare(page); await start(page, "cloze");
  await page.getByPlaceholder("Antwort eintippen…").fill("Antwort 1");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Weiter", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Karte bearbeiten", exact: true }).click();
  const front = page.getByRole("textbox", { name: "Vorderseite (Frage)", exact: true });
  await front.fill("Neue Frage"); await page.keyboard.press("Enter");
  await expect(front).toHaveValue("Neue Frage\n");
  await expect(page.locator(".cl-q")).toHaveText("Frage 1");
  expect(record.reviews).toEqual([]); await clean(record, page);
});

test("keyboard help is visible and describes flip plus rating keys", async ({ page }) => {
  const record = await prepare(page); await start(page);
  const help = page.getByText(/^Tastatur:/);
  await expect(help).toBeVisible(); await expect(help).toContainText("Enter");
  await expect(help).toContainText("Leertaste"); await expect(help).toContainText("1–4");
  await expect(help).toContainText("Nochmal"); await expect(help).toContainText("Leicht");
  await page.screenshot({ path: `test-results/keyboard-help-${test.info().project.name}.png`, fullPage: true });
  await clean(record, page);
});

test("home due link is reachable by Tab and opens learning with Enter", async ({ page }) => {
  const record = await prepare(page); await page.goto("/dashboard/home");
  const due = page.getByRole("link", { name: "3 fällige Karten jetzt lernen", exact: true });
  await expect(due).toBeVisible();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    if (await due.evaluate(el => el === document.activeElement)) break;
  }
  await expect(due).toBeFocused();
  await page.keyboard.press("Enter"); await expect(page).toHaveURL(/\/dashboard\/learn$/);
  expect(await page.locator("a a, a [role=link]").count()).toBe(0); await clean(record, page);
});

test("discard confirmation traps focus, hides the editor and restores the draft", async ({ page }) => {
  const record = await prepare(page); await start(page);
  await page.getByRole("button", { name: "Karte bearbeiten", exact: true }).click();
  const front = page.getByRole("textbox", { name: "Vorderseite (Frage)", exact: true });
  await front.fill("Entwurf bleibt");
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  const confirm = page.getByRole("alertdialog", { name: "Änderungen verwerfen?", exact: true });
  const keep = confirm.getByRole("button", { name: "Weiter bearbeiten", exact: true });
  const discard = confirm.getByRole("button", { name: "Verwerfen", exact: true });
  await expect(keep).toBeFocused(); await page.keyboard.press("Tab"); await expect(discard).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(keep).toBeFocused();
  expect(await page.getByRole("textbox", { name: "Vorderseite (Frage)" }).count()).toBe(0);
  await page.screenshot({ path: `test-results/discard-dialog-${test.info().project.name}.png`, fullPage: true });
  await page.keyboard.press("Escape"); await expect(confirm).toHaveCount(0);
  await expect(front).toHaveValue("Entwurf bleibt"); await expect(front).toBeFocused();
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Verwerfen", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Karte bearbeiten", exact: true })).toBeFocused();
  await clean(record, page);
});

test("flip and card actions expose separate buttons and only the visible face", async ({ page }) => {
  const record = await prepare(page); await start(page);
  const card = page.locator(".study-card");
  expect(await card.evaluate(root => Array.from(root.querySelectorAll("button")).filter(button => button.parentElement?.closest("button, [role=button]")).length)).toBe(0);
  const flip = page.getByRole("button", { name: "Karte umdrehen", exact: true });
  await expect(flip).toHaveAttribute("aria-pressed", "false");
  const frontAX = await card.ariaSnapshot(); expect(frontAX).toContain("Frage 1"); expect(frontAX).not.toContain("Antwort 1");
  await flip.focus(); await page.keyboard.press("Space"); await expect(flip).toHaveAttribute("aria-pressed", "true");
  const ax = await card.ariaSnapshot(); expect(ax).toContain("Antwort 1"); expect(ax).not.toContain("Frage 1");
  await test.info().attach("learning-card-accessibility", { body: `${frontAX}\n\nFlipped:\n${ax}`, contentType: "text/plain" });
  await page.getByRole("button", { name: "Karte markieren", exact: true }).focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Markierung entfernen", exact: true })).toBeVisible();
  await expect(flip).toHaveAttribute("aria-pressed", "true"); await clean(record, page);
});

for (const location of ["library", "folder"] as const) {
  for (const exit of ["Tab", "focus-out"] as const) {
    test(`${location} menu closes on ${exit} without taking focus back`, async ({ page }) => {
      const record = await prepare(page); await page.goto(location === "library" ? "/dashboard" : `/dashboard/folder/${folderId}`);
      const trigger = page.getByRole("button", { name: location === "library" ? "Deck-Optionen" : "Ordner-Optionen", exact: true }).first();
      await trigger.click(); const menu = page.getByRole("menu"); await expect(menu).toBeVisible();
      await page.keyboard.press("ArrowDown"); await expect(menu.getByRole("menuitem").first()).toBeFocused();
      if (exit === "Tab") { await menu.getByRole("menuitem").last().focus(); await page.keyboard.press("Tab"); }
      else { await page.locator("a[href]").first().focus(); }
      await expect(menu).toHaveCount(0); await expect(trigger).not.toBeFocused();
      // Existing Escape and arrow behavior stays intact.
      await trigger.click(); await page.keyboard.press("End"); await expect(page.getByRole("menuitem").last()).toBeFocused();
      await page.keyboard.press("Escape"); await expect(menu).toHaveCount(0); await expect(trigger).toBeFocused();
      await clean(record, page);
    });
  }
}

test("a complete keyboard-only flashcard round still flips, rates and ends", async ({ page }) => {
  const record = await prepare(page); await start(page);
  for (let i = 1; i <= 3; i++) {
    await expect(page.locator(".study-card")).toContainText(`Frage ${i}`);
    const flip = page.getByRole("button", { name: "Karte umdrehen", exact: true });
    await flip.focus(); await page.keyboard.press("Enter"); await page.keyboard.press("3");
    if (i < 3) await expect(page.locator(".study-card")).toContainText(`Frage ${i + 1}`);
  }
  await expect(page.getByText(/Du hast 3 Karten wiederholt/)).toBeVisible();
  await expect.poll(() => record.reviews.length).toBe(3); await clean(record, page);
  await page.screenshot({ path: `test-results/keyboard-summary-${test.info().project.name}.png`, fullPage: true });
});

// Positive control: Enter must still check and advance outside the editor.
test("complete cloze keyboard flow checks once, shows feedback and advances", async ({ page }) => {
  const record = await prepare(page); await start(page, "cloze");
  for (let i = 1; i <= 3; i++) {
    await expect(page.locator(".cl-q")).toHaveText(`Frage ${i}`);
    await page.getByPlaceholder("Antwort eintippen…").fill(`Antwort ${i}`);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toHaveText("Richtig.");
    await expect(page.locator(".cl-q")).toHaveText(`Frage ${i}`);
    await page.getByRole("button", { name: i === 3 ? "Zur Auswertung" : "Weiter", exact: true }).focus();
    await page.keyboard.press("Enter");
  }
  await expect(page.getByText("3 von 3 richtig", { exact: true })).toBeVisible();
  await expect.poll(() => record.reviews.length).toBe(3); await clean(record, page);
});
