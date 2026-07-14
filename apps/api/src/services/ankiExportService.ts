import { listCardsForDeck } from "@/lib/db";
import { getSubscriptionStatus } from "./subscriptionService";
import { assertEntitlement } from "@/lib/limits";

export interface AnkiExportResult {
  fileName: string;
  mimeType: string;
  content: string;
}

export async function exportDeckAsApkg(
  userId: string,
  deckId: string
): Promise<AnkiExportResult> {
  // Offline download is a Pro entitlement (#235) — enforce it server-side.
  const { tier } = await getSubscriptionStatus(userId);
  assertEntitlement(tier, "offlineDownload");
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
