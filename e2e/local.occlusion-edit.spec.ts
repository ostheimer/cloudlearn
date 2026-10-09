import { test, expect, type Page } from "@playwright/test";
const deckId = "10000000-0000-4000-8000-000000000731";
const userId = "20000000-0000-4000-8000-000000000731";
const ids = Array.from({ length: 5 }, (_, i) => `30000000-0000-4000-8000-00000000073${i + 1}`);
const path = `${userId}/${deckId}/image.png`;
const regionA = { x: .1, y: .1, w: .2, h: .2, label: "Alpha" };
const regionB = { x: .6, y: .3, w: .2, h: .2, label: "Beta" };
type Region = typeof regionA & { cardIds: string[] };
async function prepare(page: Page, english: boolean, failFirst = false) {
  const cards = [0, 1, 2, 3, 4].map(i => ({ id: ids[i]!, userId, deckId, type: i === 4 ? "basic" : "occlusion", sourceImageUrl: i === 3 ? path.replace("image.png", "other.png") : path,
    front: "Original question", back: i === 0 ? (english ? "First region" : "Erster Bereich") : i === 3 ? "Other image" : i === 4 ? "Ordinary card" : (english ? "Second region" : "Zweiter Bereich"),
    extraData: { regions: [regionA, regionB], hideIndex: i === 1 || i === 2 ? 1 : 0, custom: "preserve" },
    fsrsDue: "2099-01-01T00:00:00Z", fsrsState: "review", fsrsReps: 17, fsrsStability: 42, starred: true, deletedAt: null as string | null,
  }));
  const original = structuredClone(cards);
  const writes: { sourceImageUrl: string; expectedCards: { id: string }[]; regions: Region[] }[] = [];
  const unexpected: string[] = [], errors: string[] = [];
  let failed = false;
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url()), pathname = url.pathname;
    const json = (body: unknown) => route.fulfill({ json: body });
    if (pathname === "/storage/v1/object/sign/card-images") {
      const body = req.postDataJSON() as { paths: string[] };
      return json(body.paths.map(p => ({ path: p, signedURL: `/object/sign/card-images/${p}?token=synthetic` })));
    }
    if (pathname.startsWith("/storage/v1/object/sign/card-images/")) return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#e0f2fe"/><circle cx="180" cy="120" r="55" fill="#38bdf8"/><rect x="540" y="180" width="180" height="120" fill="#4ade80"/><path d="M90 470 L230 410 L240 540Z" fill="#a78bfa"/></svg>' });
    if (pathname.startsWith("/api/v1/")) {
      if (pathname === `/api/v1/decks/${deckId}/cards`) return json({ cards: cards.filter(c => !c.deletedAt) });
      if (pathname === `/api/v1/decks/${deckId}/occlusion`) {
        if (failFirst && !failed) { failed = true; return route.fulfill({ status: 409, json: { code: "OCCLUSION_CONFLICT", message: "Das Bild wurde inzwischen geändert. Lade es erneut und prüfe deine Änderungen." } }); }
        const body = req.postDataJSON() as typeof writes[number];
        writes.push(body);
        const regions = body.regions.map(({ cardIds: _ids, ...r }) => r);
        const assigned = body.regions.flatMap(r => r.cardIds);
        for (const c of cards) {
          if (c.type !== "occlusion" || c.sourceImageUrl !== body.sourceImageUrl || c.deckId !== deckId) continue;
          if (!assigned.includes(c.id)) c.deletedAt = "2026-10-09T12:00:00Z";
          else {
            const i = body.regions.findIndex(r => r.cardIds.includes(c.id));
            c.back = regions[i]!.label;
            c.extraData = { ...c.extraData, regions, hideIndex: i };
          }
        }
        for (let i = 0; i < body.regions.length; i++) {
          if (!body.regions[i]!.cardIds.length) cards.push({ ...structuredClone(original[0]!), id: "30000000-0000-4000-8000-000000000739", back: regions[i]!.label, fsrsReps: 0, fsrsStability: 0, extraData: { regions, hideIndex: i, custom: "new" }, deletedAt: null });
        }
        return json({ updated: assigned.length, created: body.regions.filter(r => !r.cardIds.length).length, deleted: body.expectedCards.filter(c => !assigned.includes(c.id)).length });
      }
      if (pathname === "/api/v1/account/profile") return json({ displayName: "Testperson" });
      if (pathname === "/api/v1/usage") return json({ tier: "pro", lpBalance: 10 });
      unexpected.push(`${req.method()} ${pathname}`); return json({});
    }
    if (url.origin === "http://127.0.0.1:4189") return route.continue();
    unexpected.push(req.url()); return route.abort();
  });
  await page.addInitScript(({ userId }) => {
    localStorage.setItem("clearn_onboarding_completed", "true");
    localStorage.setItem("sb-127-auth-token", JSON.stringify({ access_token: "synthetic-token", refresh_token: "synthetic-refresh", expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, token_type: "bearer", user: { id: userId, email: "learner@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } }));
  }, { userId });
  return { cards, original, writes, unexpected, errors };
}
async function shot(page: Page, name: string, project: string) {
  await expect.poll(() => page.locator("img").evaluateAll(imgs => imgs.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: `test-results/occlusion/${project}-${name}.png`, fullPage: true });
}
async function draw(page: Page, x: number, y: number, w: number, h: number) {
  const stage = page.locator(".occ-stage");
  await stage.scrollIntoViewIfNeeded();
  const box = (await stage.boundingBox())!;
  await page.mouse.move(box.x + x * box.width, box.y + y * box.height);
  await page.mouse.down();
  await page.mouse.move(box.x + (x+w) * box.width, box.y + (y+h) * box.height, { steps: 8 });
  await page.mouse.up();
}

test("grouped images edit, add/remove regions and persist retained siblings and learning state", async ({ page }, info) => {
  const english = info.project.name.endsWith("en"), fixture = await prepare(page, english);
  await page.goto(`/dashboard/deck/${deckId}/occlusion/images`);
  await expect(page.locator(".occ-image-card")).toHaveCount(2);
  await expect(page.locator(".occ-image-card").first()).toContainText("2 Bereiche · 3 Karten");
  await shot(page, "images", info.project.name);
  await page.getByRole("link", { name: "Bild bearbeiten", exact: true }).first().click();
  await expect(page.getByLabel("Beschriftung Bereich 1", { exact: true })).toHaveValue(english ? "First region" : "Erster Bereich");
  expect(fixture.writes).toEqual([]);
  await page.getByRole("button", { name: "Neu zeichnen", exact: true }).nth(1).click();
  await draw(page, .5, .3, .25, .22);
  await page.getByLabel("Beschriftung Bereich 2", { exact: true }).fill(english ? "Updated nucleus" : "Zellkern geändert");
  await draw(page, .1, .7, .22, .2);
  await page.getByLabel("Beschriftung Bereich 3", { exact: true }).fill(english ? "New region" : "Neuer Bereich");
  await page.locator(".occ-item").first().getByRole("button", { name: "Bereich 1 entfernen", exact: true }).click();
  await shot(page, "editor", info.project.name);
  await page.getByRole("button", { name: "Änderungen speichern", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("1 Karte wandert in den Papierkorb");
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  expect(fixture.writes).toEqual([]);
  await page.getByRole("button", { name: "Änderungen speichern", exact: true }).click();
  await page.getByRole("button", { name: "Speichern und in den Papierkorb", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Deine Bilder", exact: true })).toBeVisible();
  expect(fixture.writes).toHaveLength(1);
  expect(fixture.writes[0]!.sourceImageUrl).toBe(path);
  expect(fixture.writes[0]!.expectedCards.map(c => c.id)).toEqual(ids.slice(0,3));
  for (const id of ids.slice(1,3)) {
    const c = fixture.cards.find(c => c.id === id)!;
    expect(c).toMatchObject({ id, fsrsReps: 17, fsrsStability: 42, starred: true, sourceImageUrl: path, extraData: { hideIndex: 0, custom: "preserve" } });
    expect(c.extraData.regions[0]!.x).toBeCloseTo(.5, 2);
  }
  expect(fixture.cards[0]!.deletedAt).not.toBeNull();
  expect(fixture.cards[3]).toEqual(fixture.original[3]);
  expect(fixture.cards[4]).toEqual(fixture.original[4]);
  await page.reload();
  await expect(page.locator(".occ-image-card").first()).toContainText("2 Bereiche · 3 Karten");
  await page.getByRole("link", { name: "Bild bearbeiten", exact: true }).first().click();
  await expect(page.getByLabel("Beschriftung Bereich 1", { exact: true })).toHaveValue(english ? "Updated nucleus" : "Zellkern geändert");
  await expect(page.getByLabel("Beschriftung Bereich 2", { exact: true })).toHaveValue(english ? "New region" : "Neuer Bereich");
  await expect(page.getByRole("button", { name: "Änderungen speichern", exact: true })).toBeDisabled();
  await shot(page, "persisted", info.project.name);
  expect(fixture.errors).toEqual([]); expect(fixture.unexpected).toEqual([]);
});

test("save conflicts preserve the editable draft and leaving needs a deliberate discard", async ({ page }, info) => {
  const fixture = await prepare(page, info.project.name.endsWith("en"), true);
  await page.goto(`/dashboard/deck/${deckId}/occlusion/edit/${ids[0]}`);
  await page.getByLabel("Beschriftung Bereich 1", { exact: true }).fill("Retained draft");
  await page.getByRole("button", { name: "Änderungen speichern", exact: true }).click();
  await expect(page.locator(".form-error")).toContainText("inzwischen geändert");
  await expect(page.getByLabel("Beschriftung Bereich 1", { exact: true })).toHaveValue("Retained draft");
  expect(fixture.cards).toEqual(fixture.original);
  await page.getByRole("link", { name: "Deine Bilder", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Änderungen verwerfen?" })).toBeVisible();
  await page.getByRole("button", { name: "Weiter zeichnen", exact: true }).click();
  await expect(page.getByLabel("Beschriftung Bereich 1", { exact: true })).toHaveValue("Retained draft");
  expect(fixture.writes).toEqual([]);
  expect(fixture.errors).toEqual([]); expect(fixture.unexpected).toEqual([]);
});
