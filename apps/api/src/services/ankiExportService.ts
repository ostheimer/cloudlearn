import { listCardsForDeck } from "@/lib/db";

export interface AnkiExportResult {
  fileName: string;
  mimeType: string;
  content: string;
}

export async function exportDeckAsApkg(
  userId: string,
  deckId: string
): Promise<AnkiExportResult> {
  const cards = await listCardsForDeck(userId, deckId);
  const content = JSON.stringify({
    format: "apkg-mock",
    version: 1,
    cards: cards.map((card) => ({ front: card.front, back: card.back })),
  });

  return {
    fileName: `${deckId}.apkg`,
    mimeType: "application/octet-stream",
    content,
  };
}
