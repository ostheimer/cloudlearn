import { describe, expect, it } from "vitest";
import type { Card, Deck } from "./api";
import { cardsFromOfflineDeckCache, offlineDeckStorageKey } from "./offlineDeckCache";

const deck: Deck = {
  id: "deck-1",
  userId: "user-1",
  title: "Deutsch",
  tags: [],
  createdAt: "2026-07-03T00:00:00.000Z",
  updatedAt: "2026-07-03T00:00:00.000Z",
};

const card: Card = {
  id: "card-1",
  userId: "user-1",
  deckId: deck.id,
  front: "Hund",
  back: "dog",
  type: "basic",
  difficulty: "medium",
  tags: [],
  starred: false,
  fsrsDue: "2026-07-03T00:00:00.000Z",
  fsrsState: "new",
};

describe("offline deck cache", () => {
  it("uses the same storage key as the deck download flow", () => {
    expect(offlineDeckStorageKey("deck-1")).toBe("offline_deck_deck-1");
  });

  it("returns cached cards from a valid offline export payload", () => {
    const raw = JSON.stringify({
      deck,
      cards: [card],
      exportedAt: "2026-07-03T00:00:00.000Z",
    });

    expect(cardsFromOfflineDeckCache(raw)).toEqual([card]);
  });

  it("ignores missing, malformed, or cardless cache payloads", () => {
    expect(cardsFromOfflineDeckCache(null)).toBeNull();
    expect(cardsFromOfflineDeckCache("{")).toBeNull();
    expect(cardsFromOfflineDeckCache(JSON.stringify({ deck }))).toBeNull();
  });

  it("ignores cache payloads with malformed cards", () => {
    const raw = JSON.stringify({
      deck,
      cards: [{ ...card, front: null }],
      exportedAt: "2026-07-03T00:00:00.000Z",
    });

    expect(cardsFromOfflineDeckCache(raw)).toBeNull();
  });
});
