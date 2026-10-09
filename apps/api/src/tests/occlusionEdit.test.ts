import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getDeck: vi.fn(), listCardsForDeck: vi.fn(), saveOcclusionImage: vi.fn(), getSubscriptionStatus: vi.fn() }));
vi.mock("@/lib/db", () => mocks);
vi.mock("@/services/subscriptionService", () => mocks);
import { editOcclusionImageForUser } from "@/services/occlusionService";
const userId = "20000000-0000-4000-8000-000000000731";
const deckId = "10000000-0000-4000-8000-000000000731";
const id = "30000000-0000-4000-8000-000000000731";
const otherId = "30000000-0000-4000-8000-000000000732";
const region = { x: .1, y: .1, w: .2, h: .2, label: "Nucleus" };
const card = { id, userId, deckId, type: "occlusion", sourceImageUrl: "user/image.png", back: "Nucleus", extraData: { regions: [region], hideIndex: 0 } };
const body = () => ({ userId, deckId, sourceImageUrl: card.sourceImageUrl, expectedCards: [{ id, back: card.back, extraData: card.extraData }], regions: [{ ...region, cardIds: [id] }] });
describe("atomic existing image editing (#731)", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.getDeck.mockResolvedValue({ id: deckId, userId }); mocks.listCardsForDeck.mockResolvedValue([card]); mocks.getSubscriptionStatus.mockResolvedValue({ tier: "pro" }); mocks.saveOcclusionImage.mockResolvedValue({ updated: 1, created: 0, deleted: 0 }); });
  it("updates the existing IDs in a single scoped transaction, without FSRS fields", async () => {
    await expect(editOcclusionImageForUser(body())).resolves.toEqual({ updated: 1, created: 0, deleted: 0 });
    expect(mocks.saveOcclusionImage).toHaveBeenCalledTimes(1);
    expect(mocks.saveOcclusionImage.mock.calls[0]?.[0]).toMatchObject(body());
  });
  it("rejects another user's deck", async () => {
    mocks.getDeck.mockResolvedValue(null);
    await expect(editOcclusionImageForUser(body())).rejects.toMatchObject({ status: 404 });
    expect(mocks.saveOcclusionImage).not.toHaveBeenCalled();
  });
  it("rejects foreign IDs, duplicate assignments and out-of-image geometry", async () => {
    for (const regions of [[{ ...region, cardIds: [otherId] }], [{ ...region, cardIds: [id] }, { ...region, cardIds: [id] }], [{ ...region, x: .9, w: .2, cardIds: [id] }]]) {
      await expect(editOcclusionImageForUser({ ...body(), regions })).rejects.toThrow();
    }
    expect(mocks.saveOcclusionImage).not.toHaveBeenCalled();
  });
  it("refuses incomplete or stale membership before writing", async () => {
    mocks.listCardsForDeck.mockResolvedValue([card, { ...card, id: otherId }]);
    await expect(editOcclusionImageForUser(body())).rejects.toMatchObject({ status: 409, code: "OCCLUSION_CONFLICT" });
    expect(mocks.saveOcclusionImage).not.toHaveBeenCalled();
  });
  it("soft deletion can keep zero regions and does not require creating new cards", async () => {
    mocks.getSubscriptionStatus.mockResolvedValue({ tier: "free" });
    await editOcclusionImageForUser({ ...body(), regions: [] });
    expect(mocks.saveOcclusionImage).toHaveBeenCalledTimes(1);
  });
  it("requires Pro only when a new region creates a card", async () => {
    mocks.getSubscriptionStatus.mockResolvedValue({ tier: "free" });
    await expect(editOcclusionImageForUser({ ...body(), regions: [...body().regions, { ...region, cardIds: [] }] })).rejects.toMatchObject({ status: 402 });
    expect(mocks.saveOcclusionImage).not.toHaveBeenCalled();
  });
});
