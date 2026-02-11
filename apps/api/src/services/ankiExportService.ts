import { listCardsForDeck } from "@/lib/inMemoryStore";

export interface AnkiExportResult {
  fileName: string;
  mimeType: string;
  content: string;
}

export function exportDeckAsApkg(userId: string, deckId: string): AnkiExportResult {
  const cards = listCardsForDeck(userId, deckId);
  const content = JSON.stringify({
    format: "apkg-mock",
    version: 1,
    cards: cards.map((card) => ({ front: card.front, back: card.back }))
  });

  return {
    fileName: `${deckId}.apkg`,
    mimeType: "application/octet-stream",
    content
  };
}
