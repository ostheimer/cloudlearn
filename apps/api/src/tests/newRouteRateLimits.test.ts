import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(), checkRateLimit: vi.fn(),
  getSessionProgress: vi.fn(), saveSessionProgress: vi.fn(), clearSessionProgress: vi.fn(),
  getDueCardCountsByDeck: vi.fn(), countDecksByFolderForUser: vi.fn(), listCardsInFolderForUser: vi.fn(),
  getTrashForUser: vi.fn(), emptyTrashForUser: vi.fn(), purgeCardForUser: vi.fn(), purgeDeckForUser: vi.fn(),
  restoreCardForUser: vi.fn(), restoreDeckForUser: vi.fn(), deleteCardsForUser: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/db", () => ({
  getSessionProgress: mocks.getSessionProgress,
  saveSessionProgress: mocks.saveSessionProgress,
  clearSessionProgress: mocks.clearSessionProgress,
}));
vi.mock("@/services/learnService", () => ({ getDueCardCountsByDeck: mocks.getDueCardCountsByDeck }));
vi.mock("@/services/folderService", () => ({
  countDecksByFolderForUser: mocks.countDecksByFolderForUser,
  listCardsInFolderForUser: mocks.listCardsInFolderForUser,
}));
vi.mock("@/services/cardService", () => ({ deleteCardsForUser: mocks.deleteCardsForUser }));
vi.mock("@/services/trashService", () => ({
  getTrashForUser: mocks.getTrashForUser, emptyTrashForUser: mocks.emptyTrashForUser,
  purgeCardForUser: mocks.purgeCardForUser, purgeDeckForUser: mocks.purgeDeckForUser,
  restoreCardForUser: mocks.restoreCardForUser, restoreDeckForUser: mocks.restoreDeckForUser,
}));

import * as progress from "../../app/api/v1/learn/progress/route";
import * as due from "../../app/api/v1/stats/due-by-deck/route";
import * as folderStats from "../../app/api/v1/stats/decks-by-folder/route";
import * as folderCards from "../../app/api/v1/folders/[id]/cards/route";
import * as trash from "../../app/api/v1/trash/route";
import * as restore from "../../app/api/v1/trash/restore/route";
import * as bulkDelete from "../../app/api/v1/cards/delete-many/route";

const USER = "11111111-1111-4111-8111-111111111111";
const DECK = "22222222-2222-4222-8222-222222222222";
const CARD = "33333333-3333-4333-8333-333333333333";
const OTHER_CARD = "44444444-4444-4444-8444-444444444444";
function request(path: string, method = "GET", body?: unknown) {
  return new Request(`http://localhost/api/v1/${path}`, {
    method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
  }) as never;
}
const progressQuery = `learn/progress?deckId=${DECK}&mode=flashcards`;
const cases = [
  { name: "progress GET", scope: "learn-progress", limit: 300, effect: mocks.getSessionProgress,
    call: () => progress.GET(request(progressQuery)) },
  { name: "progress PUT", scope: "learn-progress", limit: 300, effect: mocks.saveSessionProgress,
    call: () => progress.PUT(request("learn/progress", "PUT", {
      deckId: DECK, mode: "flashcards", index: 0, cardId: CARD, source: "all", reverse: false, total: 1,
    })) },
  { name: "progress DELETE", scope: "learn-progress", limit: 300, effect: mocks.clearSessionProgress,
    call: () => progress.DELETE(request(progressQuery, "DELETE")) },
  { name: "due stats", scope: "due-by-deck", limit: 60, effect: mocks.getDueCardCountsByDeck,
    call: () => due.GET(request("stats/due-by-deck")) },
  { name: "folder stats", scope: "decks-by-folder", limit: 60, effect: mocks.countDecksByFolderForUser,
    call: () => folderStats.GET(request("stats/decks-by-folder")) },
  { name: "folder cards", scope: "folder-cards", limit: 30, effect: mocks.listCardsInFolderForUser,
    call: () => folderCards.GET(request(`folders/${DECK}/cards`), { params: Promise.resolve({ id: DECK }) }) },
  { name: "trash GET", scope: "trash", limit: 60, effect: mocks.getTrashForUser,
    call: () => trash.GET(request("trash")) },
  { name: "empty trash", scope: "trash", limit: 60, effect: mocks.emptyTrashForUser,
    call: () => trash.DELETE(request("trash?all=1", "DELETE")) },
  { name: "purge deck", scope: "trash", limit: 60, effect: mocks.purgeDeckForUser,
    call: () => trash.DELETE(request(`trash?deckId=${DECK}`, "DELETE")) },
  { name: "purge card", scope: "trash", limit: 60, effect: mocks.purgeCardForUser,
    call: () => trash.DELETE(request(`trash?cardId=${CARD}`, "DELETE")) },
  { name: "restore deck", scope: "trash-restore", limit: 60, effect: mocks.restoreDeckForUser,
    call: () => restore.POST(request("trash/restore", "POST", { deckId: DECK })) },
  { name: "restore card", scope: "trash-restore", limit: 60, effect: mocks.restoreCardForUser,
    call: () => restore.POST(request("trash/restore", "POST", { cardId: CARD })) },
  { name: "bulk delete", scope: "cards-delete-many", limit: 4000, cost: 2, effect: mocks.deleteCardsForUser,
    call: () => bulkDelete.POST(request("cards/delete-many", "POST", { deckId: DECK, cardIds: [CARD, OTHER_CARD] })) },
];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getAuthUser.mockResolvedValue({ userId: USER });
  mocks.checkRateLimit.mockResolvedValue(true);
  mocks.getTrashForUser.mockResolvedValue({ decks: [], cards: [] });
  mocks.emptyTrashForUser.mockResolvedValue({ decks: 0, cards: 0 });
  for (const effect of [mocks.saveSessionProgress, mocks.restoreCardForUser, mocks.restoreDeckForUser,
    mocks.purgeCardForUser, mocks.purgeDeckForUser]) effect.mockResolvedValue(true);
  mocks.getSessionProgress.mockResolvedValue(null);
  mocks.getDueCardCountsByDeck.mockResolvedValue({});
  mocks.countDecksByFolderForUser.mockResolvedValue({});
  mocks.listCardsInFolderForUser.mockResolvedValue([]);
  mocks.deleteCardsForUser.mockResolvedValue(2);
});

describe.each(cases)("authenticated rate limits: $name (#702)", ({ call, scope, limit, effect, ...rest }) => {
  it("returns 401 without charging a budget or accessing account data", async () => {
    mocks.getAuthUser.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(effect).not.toHaveBeenCalled();
  });

  it("returns 429 before any account read/write when the budget is exhausted", async () => {
    mocks.checkRateLimit.mockResolvedValue(false);
    const response = await call();
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: "RATE_LIMITED" });
    expect(effect).not.toHaveBeenCalled();
  });

  it("charges the correct user, scope and weight before normal processing", async () => {
    expect((await call()).status).toBe(200);
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(`${scope}:${USER}`, limit, 60, "cost" in rest ? rest.cost : 1);
    expect(effect).toHaveBeenCalledOnce();
    expect(mocks.checkRateLimit.mock.invocationCallOrder[0]).toBeLessThan(effect.mock.invocationCallOrder[0]!);
  });
});


it("keeps JSON null as a validation error instead of introducing a rate-limit 500", async () => {
  mocks.deleteCardsForUser.mockImplementation(async (body: unknown) => {
    z.object({ deckId: z.string().uuid(), cardIds: z.array(z.string().uuid()) }).parse(body);
    return 0;
  });
  const response = await bulkDelete.POST(request("cards/delete-many", "POST", null));
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({ code: "VALIDATION_ERROR" });
});
