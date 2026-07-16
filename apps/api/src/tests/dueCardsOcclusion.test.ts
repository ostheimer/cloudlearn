import { beforeEach, describe, expect, it } from "vitest";
import { createCard, createDeck, listDueCards, resetStore } from "@/lib/inMemoryStore";

// "Due" feeds /learn/due (the flashcard round) and the due counts on the home
// screen and the deck badges. An occlusion card can only be learned in the
// Bild-Abdecken mode — its front is a placeholder and it is unanswerable
// without the image — so it must never be counted as due here: the learner
// would see a number they cannot act on ("3 fällig" → "keine fälligen Karten").
// db.ts's listDueCards enforces the same rule via `.neq("card_type", "occlusion")`.
const userId = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";
const soon = () => new Date(Date.now() + 60_000).toISOString();

type CardType = "basic" | "cloze" | "mcq" | "matching" | "occlusion";

const flashcard = (front: string, back: string, type: CardType) => ({
  front,
  back,
  type,
  difficulty: "medium" as const,
  tags: [] as string[],
});

describe("listDueCards — occlusion cards are never due for a flashcard round", () => {
  beforeEach(() => {
    resetStore();
  });

  it("returns the normal cards but skips the occlusion ones", () => {
    const deck = createDeck(userId, "Französisch");
    const basic = createCard(userId, deck.id, flashcard("le chien", "der Hund", "basic"));
    createCard(
      userId,
      deck.id,
      flashcard("Bild-Occlusion: Was ist an der markierten Stelle?", "Bereich 7", "occlusion")
    );

    const due = listDueCards(userId, soon());

    expect(due.map((c) => c.id)).toEqual([basic.id]);
  });

  it("reports nothing due when a deck holds only occlusion cards", () => {
    const deck = createDeck(userId, "Diagramm");
    createCard(userId, deck.id, flashcard("Bild-Occlusion: …", "Bereich 1", "occlusion"));
    createCard(userId, deck.id, flashcard("Bild-Occlusion: …", "Bereich 2", "occlusion"));

    expect(listDueCards(userId, soon())).toEqual([]);
  });

  it("still keeps every other card type", () => {
    const deck = createDeck(userId, "Gemischt");
    const basic = createCard(userId, deck.id, flashcard("a", "b", "basic"));
    const cloze = createCard(userId, deck.id, flashcard("{{c1::a}}", "b", "cloze"));

    expect(listDueCards(userId, soon()).map((c) => c.id).sort()).toEqual(
      [basic.id, cloze.id].sort()
    );
  });
});
