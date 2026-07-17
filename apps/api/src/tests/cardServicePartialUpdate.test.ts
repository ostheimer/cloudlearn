/**
 * Regression tests for updateCardForUser — PATCH /api/v1/cards/[id] must be a
 * TRUE partial update: only the fields the caller actually sent may be written.
 *
 * The bug these pin down: updateCardSchema used to build its optional fields
 * from `flashcardSchema.shape.*`, which carry `.default(...)`. Under zod v4
 * `.default(x).optional()` STILL substitutes `x` when the key is absent from the
 * input (zod v3's optional wrapper short-circuited on undefined first, so the
 * same code was safe there). The parsed result therefore never had `undefined`
 * for type/difficulty/tags, the service's `!== undefined` guards always passed,
 * and EVERY update wrote type="basic", difficulty="medium", tags=[].
 *
 * Real-world damage: starring a card is a `{ starred: true }` PATCH (web deck
 * page, mobile learn screen). That silently converted occlusion/cloze/mcq/
 * matching cards into "basic" ones and wiped their tags — the occlusion regions
 * survived in extraData, but the card stopped rendering as an occlusion card.
 *
 * Only `@/lib/db` is mocked, so the real schema + service logic runs.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  createCard: vi.fn(),
  getDeck: vi.fn(),
  listCardsForDeck: vi.fn(),
  softDeleteCard: vi.fn(),
  updateCard: vi.fn(),
  // Reached only via the real subscriptionService, which the occlusion
  // entitlement gate consults when an explicit `type: "occlusion"` is sent.
  getSubscriptionTier: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  createCard: dbMocks.createCard,
  getDeck: dbMocks.getDeck,
  listCardsForDeck: dbMocks.listCardsForDeck,
  softDeleteCard: dbMocks.softDeleteCard,
  updateCard: dbMocks.updateCard,
  getSubscriptionTier: dbMocks.getSubscriptionTier,
}));

const userId = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";
const cardId = "1e5db9e4-7e48-4e11-8d8c-6ca90c18d42b";

/** The `updates` object handed to db.updateCard for the single expected call. */
function lastUpdates(): Record<string, unknown> {
  expect(dbMocks.updateCard).toHaveBeenCalledTimes(1);
  const call = dbMocks.updateCard.mock.calls[0];
  if (!call) throw new Error("db.updateCard was not called");
  return call[2] as Record<string, unknown>;
}

describe("updateCardForUser — partial updates never fabricate fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.updateCard.mockResolvedValue({ id: cardId, userId });
    // Free by default — none of the partial-update cases below are entitlement
    // gated, so the tier is irrelevant to them (the one exception sets it).
    dbMocks.getSubscriptionTier.mockResolvedValue({
      tier: "free",
      expiresAt: null,
      isActive: false,
    });
  });

  it("starring a card writes ONLY starred — no type/difficulty/tags", async () => {
    const { updateCardForUser } = await import("@/services/cardService");

    await updateCardForUser({ userId, cardId, starred: true });

    // The exact shape matters: an extra key here is a silent overwrite in prod.
    expect(lastUpdates()).toEqual({ starred: true });
    expect(dbMocks.updateCard).toHaveBeenCalledWith(cardId, userId, { starred: true });
  });

  it("does not smuggle in the flashcard defaults for absent keys", async () => {
    const { updateCardForUser } = await import("@/services/cardService");

    await updateCardForUser({ userId, cardId, starred: false });

    const updates = lastUpdates();
    // These are the three defaults that used to leak through.
    expect(updates).not.toHaveProperty("type");
    expect(updates).not.toHaveProperty("difficulty");
    expect(updates).not.toHaveProperty("tags");
    expect(Object.keys(updates)).toEqual(["starred"]);
  });

  it("editing only the front leaves every other column untouched", async () => {
    const { updateCardForUser } = await import("@/services/cardService");

    await updateCardForUser({ userId, cardId, front: "Neue Frage" });

    expect(lastUpdates()).toEqual({ front: "Neue Frage" });
  });

  it("still writes the fields that ARE explicitly sent", async () => {
    const { updateCardForUser } = await import("@/services/cardService");

    await updateCardForUser({
      userId,
      cardId,
      front: "F",
      back: "B",
      type: "cloze",
      difficulty: "hard",
      tags: ["bio"],
      starred: true,
    });

    expect(lastUpdates()).toEqual({
      front: "F",
      back: "B",
      type: "cloze",
      difficulty: "hard",
      tags: ["bio"],
      starred: true,
    });
  });

  it("an explicitly sent empty tag list is still honoured (not confused with absent)", async () => {
    const { updateCardForUser } = await import("@/services/cardService");

    await updateCardForUser({ userId, cardId, tags: [] });

    expect(lastUpdates()).toEqual({ tags: [] });
  });

  it("starring an occlusion card does not downgrade it to basic", async () => {
    const { updateCardForUser } = await import("@/services/cardService");

    await updateCardForUser({ userId, cardId, starred: true });

    // card_type is only written when `type` is present; absent means untouched.
    expect(lastUpdates()).not.toHaveProperty("type");
  });

  it("accepts occlusion as an explicit type (contract parity)", async () => {
    const { updateCardForUser } = await import("@/services/cardService");
    // Turning a card INTO an occlusion card is a Pro entitlement, so this needs
    // an entitled tier to reach the update at all. The point of this test is
    // unchanged: "occlusion" is a legal schema value that must be written
    // through verbatim, without fabricating neighbouring fields. The free-tier
    // rejection is pinned separately in occlusionEntitlement.test.ts.
    dbMocks.getSubscriptionTier.mockResolvedValue({
      tier: "pro",
      expiresAt: null,
      isActive: true,
    });

    await updateCardForUser({ userId, cardId, type: "occlusion" });

    expect(lastUpdates()).toEqual({ type: "occlusion" });
  });

  it("still rejects invalid values — validation is not weakened by the fix", async () => {
    const { updateCardForUser } = await import("@/services/cardService");

    await expect(updateCardForUser({ userId, cardId, type: "nonsense" })).rejects.toThrow();
    await expect(updateCardForUser({ userId, cardId, difficulty: "trivial" })).rejects.toThrow();
    await expect(updateCardForUser({ userId, cardId, front: "" })).rejects.toThrow();
    // tag rules (max 10 tags, each 1..40 chars) survive the unwrapping
    await expect(
      updateCardForUser({ userId, cardId, tags: Array(11).fill("x") })
    ).rejects.toThrow();
    await expect(updateCardForUser({ userId, cardId, tags: [""] })).rejects.toThrow();
    expect(dbMocks.updateCard).not.toHaveBeenCalled();
  });
});
