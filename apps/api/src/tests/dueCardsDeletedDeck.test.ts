import { beforeEach, describe, expect, it } from "vitest";
import {
  createCard,
  createDeck,
  listCardsForDeck,
  listDueCards,
  resetStore,
  softDeleteDeck,
} from "@/lib/inMemoryStore";

// Deleting a deck is a soft delete. Historically only the deck row was marked,
// its cards stayed "alive" and kept counting as due forever — the home tile
// showed 219 due where the deck list summed to ~20 (#495). Two rules pin that
// down: cards of a soft-deleted deck are never due (db.ts enforces this via an
// inner join on `decks.deleted_at is null`), and softDeleteDeck marks the
// contained cards itself so plain card counts (plan limit) stay honest too.
const userId = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";
const soon = () => new Date(Date.now() + 60_000).toISOString();

const flashcard = (front: string, back: string) => ({
  front,
  back,
  type: "basic" as const,
  difficulty: "medium" as const,
  tags: [] as string[],
});

describe("listDueCards — cards of soft-deleted decks are never due (#495)", () => {
  beforeEach(() => {
    resetStore();
  });

  it("stops counting a deck's cards as due once the deck is deleted", () => {
    const kept = createDeck(userId, "Französisch");
    const doomed = createDeck(userId, "Altes Halbjahr");
    const keptCard = createCard(userId, kept.id, flashcard("le chien", "der Hund"));
    createCard(userId, doomed.id, flashcard("le chat", "die Katze"));
    createCard(userId, doomed.id, flashcard("le cheval", "das Pferd"));

    expect(listDueCards(userId, soon())).toHaveLength(3);

    expect(softDeleteDeck(doomed.id)).toBe(true);

    expect(listDueCards(userId, soon()).map((c) => c.id)).toEqual([keptCard.id]);
  });

  it("soft-deletes the contained cards together with the deck", () => {
    const deck = createDeck(userId, "Biologie");
    createCard(userId, deck.id, flashcard("Mitochondrium", "Kraftwerk der Zelle"));
    createCard(userId, deck.id, flashcard("Ribosom", "Proteinfabrik"));

    softDeleteDeck(deck.id);

    // listCardsForDeck filters deletedAt — an empty result proves the cards
    // were marked, not merely hidden behind the deck's own deletedAt.
    expect(listCardsForDeck(userId, deck.id)).toEqual([]);
  });

  it("leaves cards of other decks untouched when one deck is deleted", () => {
    const a = createDeck(userId, "Deck A");
    const b = createDeck(userId, "Deck B");
    createCard(userId, a.id, flashcard("a1", "x"));
    const bCard = createCard(userId, b.id, flashcard("b1", "y"));

    softDeleteDeck(a.id);

    expect(listCardsForDeck(userId, b.id).map((c) => c.id)).toEqual([bCard.id]);
    expect(listDueCards(userId, soon()).map((c) => c.id)).toEqual([bCard.id]);
  });
});
