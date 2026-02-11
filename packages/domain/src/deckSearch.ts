export interface SearchableDeck {
  id: string;
  title: string;
  tags: string[];
  deletedAt?: string | null;
}

export function searchDecks(decks: SearchableDeck[], query: string): SearchableDeck[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) {
    return decks.filter((deck) => !deck.deletedAt);
  }

  return decks.filter((deck) => {
    if (deck.deletedAt) {
      return false;
    }

    const inTitle = deck.title.toLocaleLowerCase().includes(normalized);
    const inTags = deck.tags.some((tag) => tag.toLocaleLowerCase().includes(normalized));
    return inTitle || inTags;
  });
}
