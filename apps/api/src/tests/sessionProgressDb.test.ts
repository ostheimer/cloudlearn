import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  maybeSingle: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock("../lib/supabase", () => ({ createSupabaseAdminClient: () => db }));

import { getSessionProgress, saveSessionProgress } from "../lib/db";

const progress = {
  index: 1,
  cardId: "44444444-4444-4444-8444-444444444444",
  cardIds: ["55555555-5555-4555-8555-555555555555", "44444444-4444-4444-8444-444444444444"],
  source: "due",
  reverse: false,
  total: 2,
};

beforeEach(() => {
  vi.resetAllMocks();
  db.from.mockReturnValue(db);
  db.select.mockReturnValue(db);
  db.eq.mockReturnValue(db);
  db.is.mockReturnValue(db);
  db.upsert.mockResolvedValue({ error: null });
});

describe("session progress database mapping", () => {
  it("stores and reads the queue snapshot without changing its order", async () => {
    db.maybeSingle.mockResolvedValueOnce({ data: { id: "deck", user_id: "user", title: "Deck", tags: [] }, error: null });
    expect(await saveSessionProgress("user", "deck", "flashcards", progress)).toBe(true);
    expect(db.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user", deck_id: "deck", card_ids: progress.cardIds,
    }), { onConflict: "user_id,deck_id,mode" });
    db.maybeSingle.mockResolvedValueOnce({ data: {
      card_index: progress.index, card_id: progress.cardId, card_ids: progress.cardIds,
      source: progress.source, reverse: false, total: 2, results: null,
      updated_at: "2026-09-08T09:00:00.000Z",
    }, error: null });
    expect(await getSessionProgress("user", "deck", "flashcards")).toEqual({
      ...progress, updatedAt: "2026-09-08T09:00:00.000Z",
    });
    expect(db.select).toHaveBeenCalledWith(expect.stringContaining("card_ids"));
  });

  it("keeps old progress without a snapshot compatible and clears an old snapshot on legacy writes", async () => {
    const { cardIds: _cardIds, ...legacy } = progress;
    db.maybeSingle.mockResolvedValueOnce({ data: { id: "deck", user_id: "user", title: "Deck", tags: [] }, error: null });
    expect(await saveSessionProgress("user", "deck", "flashcards", legacy)).toBe(true);
    expect(db.upsert).toHaveBeenCalledWith(expect.objectContaining({ card_ids: null }), expect.anything());
    db.maybeSingle.mockResolvedValueOnce({ data: {
      card_index: progress.index, card_id: progress.cardId, card_ids: null,
      source: progress.source, reverse: false, total: 2, results: null,
      updated_at: "2026-09-08T09:00:00.000Z",
    }, error: null });
    expect(await getSessionProgress("user", "deck", "flashcards")).toEqual({
      ...legacy, updatedAt: "2026-09-08T09:00:00.000Z",
    });
  });
});


describe("session progress error handling (#702)", () => {
  it("propagates database failures instead of reporting missing progress", async () => {
    db.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "connection terminated" } });
    await expect(getSessionProgress("user", "deck", "flashcards"))
      .rejects.toThrow("getSessionProgress: connection terminated");
  });

  it("returns null only after a successful empty lookup", async () => {
    db.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(getSessionProgress("user", "deck", "cloze")).resolves.toBeNull();
  });
});
