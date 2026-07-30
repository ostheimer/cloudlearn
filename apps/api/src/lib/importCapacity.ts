import type { Flashcard, MilestoneAward, SubscriptionTier } from "@/lib/contracts";
import {
  createDeck,
  getDeck,
  insertCards,
  listCardIdsForDeck,
  listDeckIdsForUser,
  softDeleteCardsByIds,
  softDeleteDeck,
  type DeckRecord,
} from "@/lib/db";
import { getLimitsForTier } from "@/lib/featureGates";
import { HttpError } from "@/lib/http";
import { clampTitle } from "@/lib/titleLimit";
import { awardFirstDeckMilestone } from "@/services/lpService";

/**
 * Plan limits for the three AI import paths — scan, PDF import, URL import
 * (#411). They used to write straight to the database without counting, so a
 * free account could pass both the deck and the card limit that the manual
 * "new card" / "new deck" buttons enforce.
 *
 * Two things make this path different from the manual one:
 *
 *  1. The user has already PAID Lernpunkte when we find out. So "nothing fits"
 *     must throw, because the route wraps the service in
 *     `runLpChargedIdempotentRequest`, which refunds on any throw. A partial
 *     delivery must NOT throw — the user was warned in the app beforehand and
 *     chose to go ahead (Laras Entscheidung).
 *  2. The rejection must not look like "you are out of Lernpunkte". The manual
 *     path answers 402/PAYWALL_REQUIRED, and `scan.tsx` in the app turns EVERY
 *     402 into the "buy Lernpunkte" modal (#371) — which would tell the user to
 *     buy points she already has. Limit rejections therefore answer
 *     409/CONFLICT with a plain German message: old app builds do not match 409
 *     anywhere and fall through to their generic error alert, which shows
 *     exactly that message.
 */
export const IMPORT_LIMIT_STATUS = 409;
export const DECK_LIMIT_REACHED = "DECK_LIMIT_REACHED";
export const DECK_FULL = "DECK_FULL";

export type ImportTarget =
  | { kind: "existing"; deck: DeckRecord; freeSlots: number }
  | { kind: "new"; freeSlots: number };

export interface StoredImport {
  deck: DeckRecord;
  /** The cards that really made it into the deck, in material order. */
  savedCards: Flashcard[];
  savedCount: number;
  generatedCount: number;
  /** True when the deck could not take every generated card. */
  truncated: boolean;
  /**
   * Frisch gutgeschriebene Meilenstein-Boni (#637) — nur belegt, wenn hier ein
   * NEUES Deck entstand und es das erste des Kontos war. Beim Anhängen an ein
   * bestehendes Deck entsteht kein Deck und damit auch kein Bonus.
   */
  milestones: MilestoneAward[];
}

/**
 * Picks `keep` items spread evenly over the WHOLE list instead of keeping the
 * first `keep` (Laras Entscheidung): a chapter that yields more cards than fit
 * stays covered end to end, just at a lower density. Keeping a prefix would
 * save chapter 1 in full and drop everything after it.
 *
 * The step is `(total - 1) / (keep - 1)`, so the first and the last item are
 * always kept and the rest sit at even distances in between.
 *
 * Example 160 cards, 12 slots: step = 159/11 = 14.45 → indices
 * 0, 14, 29, 43, 58, 72, 87, 101, 116, 130, 145, 159.
 */
export function selectEvenlySpread<T>(items: T[], keep: number): T[] {
  if (keep <= 0) return [];
  if (keep >= items.length) return [...items];
  if (keep === 1) return [items[0]!];

  const step = (items.length - 1) / (keep - 1);
  const picked: T[] = [];
  for (let i = 0; i < keep; i += 1) {
    picked.push(items[Math.round(i * step)]!);
  }
  return picked;
}

function deckLimitError(maxDecks: number): HttpError {
  return new HttpError(
    `Deck-Grenze erreicht: Dein Tarif erlaubt ${maxDecks} Decks. Lösche ein Deck oder speichere in ein bestehendes Deck. Deine Lernpunkte wurden zurückgebucht.`,
    IMPORT_LIMIT_STATUS,
    DECK_LIMIT_REACHED
  );
}

function deckFullError(maxCardsPerDeck: number): HttpError {
  return new HttpError(
    `Dieses Deck ist voll: Dein Tarif erlaubt ${maxCardsPerDeck} Karten pro Deck. Es wurde keine Karte gespeichert, deine Lernpunkte wurden zurückgebucht.`,
    IMPORT_LIMIT_STATUS,
    DECK_FULL
  );
}

/**
 * Runs BEFORE the expensive model call: if nothing can fit anyway, we neither
 * burn a generation nor keep the user's Lernpunkte. An unknown or foreign
 * `deckId` falls back to "new deck", exactly as the import services did before
 * — `getDeck` filters by owner, so this is not a way into someone else's deck.
 */
export async function reserveImportTarget(params: {
  userId: string;
  tier: SubscriptionTier;
  deckId: string | undefined;
}): Promise<ImportTarget> {
  const { userId, tier, deckId } = params;
  const { maxDecks, maxCardsPerDeck } = getLimitsForTier(tier);

  const deck = deckId ? await getDeck(deckId, userId) : null;

  if (deck) {
    const used = (await listCardIdsForDeck(userId, deck.id)).length;
    const freeSlots = Math.max(0, maxCardsPerDeck - used);
    // Existing decks that are already over the limit (they exist in production,
    // #411) keep every card they have — only new cards are refused.
    if (freeSlots === 0) throw deckFullError(maxCardsPerDeck);
    return { kind: "existing", deck, freeSlots };
  }

  const deckCount = (await listDeckIdsForUser(userId)).length;
  if (deckCount >= maxDecks) throw deckLimitError(maxDecks);
  return { kind: "new", freeSlots: maxCardsPerDeck };
}

/**
 * Creates the deck for a "new deck" import and makes the deck limit hold at
 * WRITE time, not just in the pre-check: two imports running at once both read
 * "19 decks", both insert, and together they would sit at 21.
 *
 * After inserting we re-read the user's decks in one canonical order. Every
 * concurrent writer computes the same order, so they agree on which decks are
 * inside the plan and which are the overflow — and each writer only removes its
 * OWN overflow deck. No shared transaction, no double removal.
 */
async function createDeckWithinLimit(
  userId: string,
  tier: SubscriptionTier,
  title: string,
  tags: string[]
): Promise<DeckRecord> {
  const { maxDecks } = getLimitsForTier(tier);
  // KI-Titel können beliebig lang ausfallen — gleiche Kappung wie beim
  // manuellen Anlegen (deckService, #612), damit kein Weg die Grenze umgeht.
  const deck = await createDeck(userId, clampTitle(title), tags);

  const deckIds = await listDeckIdsForUser(userId);
  const position = deckIds.indexOf(deck.id);
  if (position >= maxDecks) {
    await softDeleteDeck(deck.id, userId);
    throw deckLimitError(maxDecks);
  }
  return deck;
}

/**
 * Writes the generated cards and makes the card limit hold at WRITE time.
 *
 * Same reconciliation as `createDeckWithinLimit`: insert, then re-read the
 * deck's cards in one canonical order and take back only those OWN cards that
 * ended up beyond the limit. Chosen over the alternatives because
 *  - a single transaction is not reachable through PostgREST without moving the
 *    insert into a database function, i.e. a migration that has to be deployed
 *    by hand before the merge, and
 *  - a database-side trigger would apply to every other insert path too (deck
 *    duplication, shared-deck import, sync), which is a much larger blast
 *    radius than this issue asks for,
 * while a plain re-check before the insert would not hold at all: two writers
 * can both read "1 slot free" and both insert.
 *
 * The two copy paths named above were the loophole this deliberately left open:
 * duplicating and importing a shared deck copied every card without asking the
 * limit at all. #611 closed that with `assertDeckCopyFits` in the service layer
 * — they now refuse a source deck that does not fit rather than truncate it, so
 * the reconciliation dance below stays exclusive to the import path.
 */
async function insertCardsWithinLimit(
  userId: string,
  deckId: string,
  cards: Flashcard[],
  maxCardsPerDeck: number
): Promise<Flashcard[]> {
  if (cards.length === 0) return [];

  const inserted = await insertCards(userId, deckId, cards);
  const insertedIds = inserted.map((card) => card.id);

  const cardIds = await listCardIdsForDeck(userId, deckId);
  if (cardIds.length <= maxCardsPerDeck) return cards;

  const overflow = new Set(cardIds.slice(maxCardsPerDeck));
  const overflowIds = insertedIds.filter((id) => overflow.has(id));
  if (overflowIds.length === 0) return cards;

  await softDeleteCardsByIds(userId, deckId, overflowIds);
  const removed = new Set(overflowIds);
  return cards.filter((_card, index) => !removed.has(insertedIds[index]!));
}

/**
 * Saves an import into its target deck: truncates evenly to the free slots,
 * writes, and reports honestly how much of the material survived.
 *
 * Throws only when NOTHING fits — that is the case the route refunds.
 */
export async function storeImportedCards(params: {
  userId: string;
  tier: SubscriptionTier;
  target: ImportTarget;
  title: string;
  tags: string[];
  cards: Flashcard[];
}): Promise<StoredImport> {
  const { userId, tier, target, title, tags, cards } = params;
  const { maxCardsPerDeck } = getLimitsForTier(tier);

  const deck =
    target.kind === "existing"
      ? target.deck
      : await createDeckWithinLimit(userId, tier, title, tags);

  // „Erstes Deck erstellt" (#637). Hier statt in den vier Import-Diensten:
  // Scan, PDF, URL und das Speichern einer Vorschau laufen alle durch diese
  // eine Funktion, und ein fünfter Weg käme automatisch mit.
  const milestones = target.kind === "new" ? await awardFirstDeckMilestone(userId) : [];

  const fitting = selectEvenlySpread(cards, Math.min(cards.length, target.freeSlots));

  let savedCards: Flashcard[];
  if (target.kind === "new") {
    // A deck created moments ago cannot be written to by anyone else yet, so
    // its capacity needs no reconciliation — the truncation above is exact.
    await insertCards(userId, deck.id, fitting);
    savedCards = fitting;
  } else {
    savedCards = await insertCardsWithinLimit(userId, deck.id, fitting, maxCardsPerDeck);
  }

  if (savedCards.length === 0 && cards.length > 0) {
    throw deckFullError(maxCardsPerDeck);
  }

  return {
    deck,
    savedCards,
    savedCount: savedCards.length,
    generatedCount: cards.length,
    truncated: savedCards.length < cards.length,
    milestones,
  };
}
