/**
 * Fällige Karten kommen vom Server bunt über alle Decks gemischt. Für die
 * globale Runde vom Home-Knopf (#609) will Lara sie Deck für Deck: erst alle
 * Karten des einen Decks, dann die des nächsten — nichts vermischt sich.
 * Stabil: Die Deck-Reihenfolge folgt dem ersten Auftreten, die Reihenfolge
 * innerhalb eines Decks bleibt unverändert.
 */
export function groupCardsByDeck<T extends { deckId: string }>(cards: T[]): T[] {
  const order: string[] = [];
  const byDeck = new Map<string, T[]>();
  for (const card of cards) {
    let bucket = byDeck.get(card.deckId);
    if (!bucket) {
      bucket = [];
      byDeck.set(card.deckId, bucket);
      order.push(card.deckId);
    }
    bucket.push(card);
  }
  return order.flatMap((deckId) => byDeck.get(deckId) ?? []);
}
