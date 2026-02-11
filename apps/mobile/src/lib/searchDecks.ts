// Local deck search utility (replaces @clearn/domain dependency)
interface SearchableDeck {
  id: string;
  title: string;
  tags: string[];
}

export function searchDecks<T extends SearchableDeck>(
  decks: T[],
  query: string
): T[] {
  if (!query.trim()) return decks;
  const lower = query.toLowerCase();
  return decks.filter(
    (d) =>
      d.title.toLowerCase().includes(lower) ||
      d.tags.some((t) => t.toLowerCase().includes(lower))
  );
}
