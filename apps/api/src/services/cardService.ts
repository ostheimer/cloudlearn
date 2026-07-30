import {
  cardTagsSchema,
  cardTypeSchema,
  deriveCardType,
  difficultySchema,
  flashcardSchema,
} from "@/lib/contracts";
import { z } from "zod";
import type { CardRecord } from "@/lib/db";
import {
  createCard,
  getCard,
  getDeck,
  listCardsForDeck,
  softDeleteCard,
  softDeleteCardsByIds,
  updateCard,
} from "@/lib/db";
import { HttpError } from "@/lib/http";
import { getSubscriptionStatus } from "./subscriptionService";
import { assertCardLimit, assertEntitlement } from "@/lib/limits";

const createCardSchema = z.object({
  userId: z.string().uuid(),
  deckId: z.string().uuid(),
  card: flashcardSchema,
});

// A PATCH must touch ONLY the fields the caller actually sent. Deliberately does
// NOT reuse `flashcardSchema.shape.*`: those carry `.default(...)`, and in zod v4
// `.default(x).optional()` still fills in `x` when the key is absent (unlike v3,
// where the optional wrapper short-circuited first). Reusing them made every
// update silently write type="basic"/difficulty="medium"/tags=[], downgrading
// occlusion/cloze cards to basic on an unrelated change such as starring.
// Reuse the default-free base schemas instead so absent keys stay `undefined`.
const updateCardSchema = z.object({
  userId: z.string().uuid(),
  cardId: z.string().uuid(),
  front: z.string().min(1).optional(),
  back: z.string().min(1).optional(),
  type: cardTypeSchema.optional(),
  difficulty: difficultySchema.optional(),
  tags: cardTagsSchema.optional(),
  starred: z.boolean().optional(),
});

export async function createCardForUser(input: unknown) {
  const parsed = createCardSchema.parse(input);
  // Only allow adding cards to a deck the user owns
  const deck = await getDeck(parsed.deckId, parsed.userId);
  if (!deck) throw new HttpError("Deck not found", 404, "DECK_NOT_FOUND");
  const { tier } = await getSubscriptionStatus(parsed.userId);
  // Image occlusion is a Pro entitlement (#235) — enforce it server-side, not
  // just by hiding the editor in the client. Only *creating* an occlusion card
  // is gated: existing ones stay readable, reviewable and learnable for free
  // users (e.g. after a downgrade), so nobody loses access to their own cards.
  if (parsed.card.type === "occlusion") assertEntitlement(tier, "imageOcclusion");
  const existingCards = await listCardsForDeck(parsed.userId, parsed.deckId);
  assertCardLimit(tier, existingCards.length);
  return createCard(parsed.userId, parsed.deckId, parsed.card);
}

export async function updateCardForUser(input: unknown) {
  const parsed = updateCardSchema.parse(input);
  // Turning any card into an occlusion card is the same Pro action as creating
  // one, so it needs the same gate — otherwise the create gate above would just
  // be a create-basic-then-PATCH away. Only an explicit `type: "occlusion"`
  // trips this: since the schema above dropped the `.default(...)` wrappers, an
  // absent key stays `undefined`, so a plain `{ starred }` or text-only edit of
  // an existing occlusion card never reaches the paywall.
  if (parsed.type === "occlusion") {
    const { tier } = await getSubscriptionStatus(parsed.userId);
    assertEntitlement(tier, "imageOcclusion");
  }
  // Mirrors updateCard's own parameter type, so the allowed card types cannot
  // drift from the contract as they're extended.
  const updates: Partial<
    Pick<CardRecord, "front" | "back" | "type" | "difficulty" | "tags" | "starred">
  > = {};
  if (parsed.front !== undefined) updates.front = parsed.front;
  if (parsed.back !== undefined) updates.back = parsed.back;
  if (parsed.type !== undefined) updates.type = parsed.type;
  if (parsed.difficulty !== undefined) updates.difficulty = parsed.difficulty;
  if (parsed.tags !== undefined) updates.tags = parsed.tags;
  if (parsed.starred !== undefined) updates.starred = parsed.starred;
  // Auf der Achse basic↔cloze gilt nicht die Client-Angabe, sondern der Text:
  // eine {{cN::…}}-Markierung macht die Karte zum Lückentext, ihr Fehlen zu
  // basic (deriveCardType, wie beim Anlegen in db.createCard/insertCards).
  // Nur Text- oder Typ-Änderungen leiten ab — ein { starred }-PATCH bleibt
  // ohne Extra-Lesezugriff. Spezialtypen sind doppelt geschützt: explizit
  // gesendet werden sie unverändert übernommen (occlusion oben bereits hinter
  // der Pro-Schranke), und eine reine Textänderung an einer bestehenden
  // occlusion/mcq/matching-Karte stuft sie nicht stillschweigend zu basic um.
  if (parsed.front !== undefined || parsed.type !== undefined) {
    const requested = parsed.type;
    if (requested === undefined || requested === "basic" || requested === "cloze") {
      const existing = await getCard(parsed.cardId, parsed.userId);
      if (!existing) return null;
      const axis = requested ?? existing.type ?? "basic";
      if (axis === "basic" || axis === "cloze") {
        updates.type = deriveCardType(parsed.front ?? existing.front);
      }
    }
  }
  return updateCard(parsed.cardId, parsed.userId, updates);
}

export async function deleteCardForUser(userId: string, cardId: string): Promise<boolean> {
  return softDeleteCard(cardId, userId);
}

/**
 * Mehrere Karten eines Decks in einem Zug löschen — die Mehrfachauswahl der
 * Kartenliste (#614).
 *
 * Bewusst EINE Anfrage statt einer je Karte: zwanzig einzelne DELETEs sind
 * genau das N+1-Muster, das #612 reihenweise abgebaut hat, und ein Abbruch in
 * der Mitte hätte die Liste in einem halb gelöschten Zustand hinterlassen.
 *
 * `softDeleteCardsByIds` filtert selbst auf `user_id` und `deck_id`, fremde
 * oder deckfremde IDs können also nichts treffen (Deck-Ownership-Muster).
 * Zurück kommt die WIRKLICH getroffene Anzahl — wer eine schon gelöschte Karte
 * mitschickt, bekommt sie nicht mitgezählt, statt eine zu hohe Zahl zu lesen.
 */
const deleteCardsSchema = z.object({
  userId: z.string().uuid(),
  deckId: z.string().uuid(),
  // Obergrenze = das größte Deck, das der teuerste Tarif zulässt. Höher wäre
  // keine echte Auswahl mehr, sondern ein Versehen oder ein fremder Aufrufer.
  cardIds: z.array(z.string().uuid()).min(1).max(2000),
});

export async function deleteCardsForUser(input: unknown): Promise<number> {
  const parsed = deleteCardsSchema.parse(input);
  const deck = await getDeck(parsed.deckId, parsed.userId);
  if (!deck) throw new HttpError("Deck not found", 404, "DECK_NOT_FOUND");
  return softDeleteCardsByIds(parsed.userId, parsed.deckId, parsed.cardIds);
}
