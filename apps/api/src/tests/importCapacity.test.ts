/**
 * Unit tests for the import capacity guard (#411): even truncation and the
 * write-time limit that survives two imports running at the same time.
 *
 * `@/lib/db` is replaced by a tiny in-memory store so a second writer can be
 * interleaved deterministically — that race is the whole point of the guard.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Flashcard } from "@/lib/contracts";
import { getLimitsForTier } from "@/lib/featureGates";

interface StoredCard {
  id: string;
  deckId: string;
  front: string;
}

const store = vi.hoisted(() => ({
  cards: [] as Array<{ id: string; deckId: string; front: string; deleted: boolean }>,
  decks: [] as Array<{ id: string; deleted: boolean }>,
  nextCardId: 1,
  nextDeckId: 1,
}));

vi.mock("@/lib/db", () => ({
  getDeck: vi.fn(async (deckId: string) =>
    store.decks.some((deck) => deck.id === deckId && !deck.deleted)
      ? {
          id: deckId,
          userId: "u1",
          title: "Deck",
          tags: [],
          createdAt: "2026-07-21T00:00:00.000Z",
          updatedAt: "2026-07-21T00:00:00.000Z",
        }
      : null
  ),
  createDeck: vi.fn(async () => {
    const id = `deck-${store.nextDeckId++}`;
    store.decks.push({ id, deleted: false });
    return {
      id,
      userId: "u1",
      title: "Deck",
      tags: [],
      createdAt: "2026-07-21T00:00:00.000Z",
      updatedAt: "2026-07-21T00:00:00.000Z",
    };
  }),
  softDeleteDeck: vi.fn(async (deckId: string) => {
    const deck = store.decks.find((entry) => entry.id === deckId);
    if (deck) deck.deleted = true;
    return Boolean(deck);
  }),
  listDeckIdsForUser: vi.fn(async () =>
    store.decks.filter((deck) => !deck.deleted).map((deck) => deck.id)
  ),
  insertCards: vi.fn(async (_userId: string, deckId: string, cards: Flashcard[]) => {
    // One awaited tick before the write, so a concurrently running import can
    // slip in between "count" and "insert" — exactly the production race.
    await Promise.resolve();
    return cards.map((card) => {
      const id = `card-${store.nextCardId++}`;
      store.cards.push({ id, deckId, front: card.front, deleted: false });
      return { id, deckId, front: card.front } as unknown as StoredCard;
    });
  }),
  listCardIdsForDeck: vi.fn(async (_userId: string, deckId: string) =>
    store.cards.filter((card) => card.deckId === deckId && !card.deleted).map((card) => card.id)
  ),
  softDeleteCardsByIds: vi.fn(async (_userId: string, deckId: string, ids: string[]) => {
    let removed = 0;
    for (const card of store.cards) {
      if (card.deckId === deckId && ids.includes(card.id) && !card.deleted) {
        card.deleted = true;
        removed += 1;
      }
    }
    return removed;
  }),
}));

import {
  DECK_FULL,
  DECK_LIMIT_REACHED,
  reserveImportTarget,
  selectEvenlySpread,
  storeImportedCards,
} from "@/lib/importCapacity";
import { listCardIdsForDeck, softDeleteCardsByIds } from "@/lib/db";

function card(index: number): Flashcard {
  return {
    front: `Frage ${index}`,
    back: `Antwort ${index}`,
    type: "basic",
    difficulty: "medium",
    tags: [],
  };
}

function cards(count: number): Flashcard[] {
  return Array.from({ length: count }, (_value, index) => card(index));
}

function seedDeck(cardCount: number): string {
  const id = `deck-${store.nextDeckId++}`;
  store.decks.push({ id, deleted: false });
  for (let i = 0; i < cardCount; i += 1) {
    store.cards.push({
      id: `seed-${store.nextCardId++}`,
      deckId: id,
      front: `alt ${i}`,
      deleted: false,
    });
  }
  return id;
}

beforeEach(() => {
  store.cards.length = 0;
  store.decks.length = 0;
  store.nextCardId = 1;
  store.nextDeckId = 1;
  vi.clearAllMocks();
});

describe("selectEvenlySpread (#411)", () => {
  it("keeps the whole material instead of a prefix — 160 cards into 12 slots", () => {
    const material = Array.from({ length: 160 }, (_value, index) => index);
    const kept = selectEvenlySpread(material, 12);

    expect(kept).toEqual([0, 14, 29, 43, 58, 72, 87, 101, 116, 130, 145, 159]);
    // The point of the rule: first AND last card of the chapter survive.
    expect(kept[0]).toBe(0);
    expect(kept.at(-1)).toBe(159);
    // A "keep the first N" implementation would end at 11 — nowhere near.
    expect(kept.at(-1)!).toBeGreaterThan(150);
  });

  it("spreads the picks evenly instead of clustering them", () => {
    const kept = selectEvenlySpread(
      Array.from({ length: 160 }, (_value, index) => index),
      12
    );
    const gaps = kept.slice(1).map((value, index) => value - kept[index]!);

    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(14);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(15);
  });

  it("returns everything when it all fits and nothing when there is no room", () => {
    expect(selectEvenlySpread([1, 2, 3], 5)).toEqual([1, 2, 3]);
    expect(selectEvenlySpread([1, 2, 3], 3)).toEqual([1, 2, 3]);
    expect(selectEvenlySpread([1, 2, 3], 0)).toEqual([]);
    expect(selectEvenlySpread([1, 2, 3], 1)).toEqual([1]);
  });
});

describe("reserveImportTarget (#411)", () => {
  it("refuses a new deck at the deck limit with 409, never 402", async () => {
    const { maxDecks } = getLimitsForTier("free");
    for (let i = 0; i < maxDecks; i += 1) seedDeck(0);

    await expect(
      reserveImportTarget({ userId: "u1", tier: "free", deckId: undefined })
    ).rejects.toMatchObject({ status: 409, code: DECK_LIMIT_REACHED });

    // #371: a 402 would make the old app offer "buy Lernpunkte" for a problem
    // that no amount of Lernpunkte solves.
    await expect(
      reserveImportTarget({ userId: "u1", tier: "free", deckId: undefined })
    ).rejects.not.toMatchObject({ status: 402 });
  });

  it("refuses a full deck with 409 DECK_FULL", async () => {
    const deckId = seedDeck(getLimitsForTier("free").maxCardsPerDeck);

    await expect(
      reserveImportTarget({ userId: "u1", tier: "free", deckId })
    ).rejects.toMatchObject({ status: 409, code: DECK_FULL });
  });

  it("reports the free slots of a partly filled deck", async () => {
    const deckId = seedDeck(138);

    const target = await reserveImportTarget({ userId: "u1", tier: "free", deckId });

    expect(target).toMatchObject({ kind: "existing", freeSlots: 12 });
  });

  it("lets pro through where free is already blocked", async () => {
    for (let i = 0; i < getLimitsForTier("free").maxDecks; i += 1) seedDeck(0);

    await expect(
      reserveImportTarget({ userId: "u1", tier: "pro", deckId: undefined })
    ).resolves.toMatchObject({ kind: "new", freeSlots: 2000 });
  });
});

describe("storeImportedCards (#411)", () => {
  it("thins a 160-card import down to the 12 free slots and reports honestly", async () => {
    const deckId = seedDeck(138);
    const target = await reserveImportTarget({ userId: "u1", tier: "free", deckId });

    const stored = await storeImportedCards({
      userId: "u1",
      tier: "free",
      target,
      title: "Themengebiet 4",
      tags: ["scan"],
      cards: cards(160),
    });

    expect(stored.generatedCount).toBe(160);
    expect(stored.savedCount).toBe(12);
    expect(stored.truncated).toBe(true);
    expect(stored.savedCards[0]!.front).toBe("Frage 0");
    expect(stored.savedCards.at(-1)!.front).toBe("Frage 159");
    expect(await listCardIdsForDeck("u1", deckId)).toHaveLength(150);
  });

  it("does not touch the cards a deck already has, not even an over-limit one", async () => {
    // Production reality (#411): free decks with 125/121/138 cards exist, and
    // one deck could sit above even the new limit. Nothing gets deleted.
    const deckId = seedDeck(200);
    const before = await listCardIdsForDeck("u1", deckId);

    await expect(
      reserveImportTarget({ userId: "u1", tier: "free", deckId })
    ).rejects.toMatchObject({ code: DECK_FULL });

    expect(await listCardIdsForDeck("u1", deckId)).toEqual(before);
    expect(vi.mocked(softDeleteCardsByIds)).not.toHaveBeenCalled();
  });

  it("keeps every card for pro", async () => {
    const target = await reserveImportTarget({
      userId: "u1",
      tier: "pro",
      deckId: undefined,
    });

    const stored = await storeImportedCards({
      userId: "u1",
      tier: "pro",
      target,
      title: "Pro-Deck",
      tags: ["scan"],
      cards: cards(160),
    });

    expect(stored.savedCount).toBe(160);
    expect(stored.truncated).toBe(false);
  });

  it("throws when nothing fits any more, so the route refunds the Lernpunkte", async () => {
    const deckId = seedDeck(140);
    const target = await reserveImportTarget({ userId: "u1", tier: "free", deckId });
    // Someone else filled the deck between the pre-check and the write.
    for (let i = 0; i < 10; i += 1) {
      store.cards.push({
        id: `late-${i}`,
        deckId,
        front: "spät",
        deleted: false,
      });
    }

    await expect(
      storeImportedCards({
        userId: "u1",
        tier: "free",
        target,
        title: "Voll",
        tags: ["scan"],
        cards: cards(10),
      })
    ).rejects.toMatchObject({ status: 409, code: DECK_FULL });
  });

  it("holds the card limit when two imports write at the same time", async () => {
    const deckId = seedDeck(145);

    // Both readers see "5 slots free" before either of them writes — the exact
    // race a pre-check alone cannot close.
    const targetA = await reserveImportTarget({ userId: "u1", tier: "free", deckId });
    const targetB = await reserveImportTarget({ userId: "u1", tier: "free", deckId });
    expect(targetA).toMatchObject({ freeSlots: 5 });
    expect(targetB).toMatchObject({ freeSlots: 5 });

    const [a, b] = await Promise.all([
      storeImportedCards({
        userId: "u1",
        tier: "free",
        target: targetA,
        title: "A",
        tags: ["scan"],
        cards: cards(3),
      }),
      storeImportedCards({
        userId: "u1",
        tier: "free",
        target: targetB,
        title: "B",
        tags: ["scan"],
        cards: cards(3),
      }),
    ]);

    // 145 + 3 + 3 = 151 would be over the plan; the guard lands on exactly 150.
    expect(await listCardIdsForDeck("u1", deckId)).toHaveLength(150);
    // And each import reports only what it really kept: 3 + 2, not 3 + 3.
    expect(a.savedCount + b.savedCount).toBe(5);
    expect(a.savedCards).toHaveLength(a.savedCount);
    expect(b.savedCards).toHaveLength(b.savedCount);
  });

  it("refunds the import that the race left with nothing", async () => {
    const deckId = seedDeck(145);
    const targetA = await reserveImportTarget({ userId: "u1", tier: "free", deckId });
    const targetB = await reserveImportTarget({ userId: "u1", tier: "free", deckId });

    const results = await Promise.allSettled([
      storeImportedCards({
        userId: "u1",
        tier: "free",
        target: targetA,
        title: "A",
        tags: ["scan"],
        cards: cards(5),
      }),
      storeImportedCards({
        userId: "u1",
        tier: "free",
        target: targetB,
        title: "B",
        tags: ["scan"],
        cards: cards(5),
      }),
    ]);

    expect(await listCardIdsForDeck("u1", deckId)).toHaveLength(150);
    // The loser of the race kept zero cards, so it throws and the route hands
    // the Lernpunkte back instead of charging for nothing.
    const rejected = results.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      status: 409,
      code: DECK_FULL,
    });
  });

  it("holds the deck limit when two imports create a deck at the same time", async () => {
    const { maxDecks } = getLimitsForTier("free");
    for (let i = 0; i < maxDecks - 1; i += 1) seedDeck(0);

    const targetA = await reserveImportTarget({ userId: "u1", tier: "free", deckId: undefined });
    const targetB = await reserveImportTarget({ userId: "u1", tier: "free", deckId: undefined });

    const results = await Promise.allSettled([
      storeImportedCards({
        userId: "u1",
        tier: "free",
        target: targetA,
        title: "A",
        tags: ["scan"],
        cards: cards(1),
      }),
      storeImportedCards({
        userId: "u1",
        tier: "free",
        target: targetB,
        title: "B",
        tags: ["scan"],
        cards: cards(1),
      }),
    ]);

    expect(store.decks.filter((deck) => !deck.deleted)).toHaveLength(maxDecks);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect((rejected as PromiseRejectedResult).reason).toMatchObject({
      status: 409,
      code: DECK_LIMIT_REACHED,
    });
  });
});
