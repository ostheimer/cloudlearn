import { z } from "zod";

const publishSchema = z.object({
  userId: z.string().uuid(),
  deckId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().max(500).optional()
});

type PublishInput = z.infer<typeof publishSchema>;

interface CommunityDeck extends PublishInput {
  publishedAt: string;
  moderationStatus: "approved" | "flagged";
}

const blockedTerms = ["spam", "scam", "hate"];
const decks: CommunityDeck[] = [];
const publishCounterByDay = new Map<string, number>();

function dayKey(userId: string, now = new Date()): string {
  return `${userId}:${now.toISOString().slice(0, 10)}`;
}

function containsBlockedTerm(text: string): boolean {
  const normalized = text.toLocaleLowerCase();
  return blockedTerms.some((term) => normalized.includes(term));
}

export function publishCommunityDeck(input: unknown): CommunityDeck {
  const parsed = publishSchema.parse(input);
  const key = dayKey(parsed.userId);
  const currentCount = publishCounterByDay.get(key) ?? 0;
  if (currentCount >= 20) {
    throw new Error("COMMUNITY_PUBLISH_LIMIT_REACHED");
  }
  publishCounterByDay.set(key, currentCount + 1);

  const moderationStatus = containsBlockedTerm(`${parsed.title} ${parsed.description ?? ""}`) ? "flagged" : "approved";
  const deck: CommunityDeck = {
    ...parsed,
    publishedAt: new Date().toISOString(),
    moderationStatus
  };
  decks.push(deck);
  return deck;
}

export function listCommunityDecks(status: "approved" | "flagged" = "approved"): CommunityDeck[] {
  return decks.filter((deck) => deck.moderationStatus === status);
}

export function resetCommunityDeckStore(): void {
  decks.length = 0;
  publishCounterByDay.clear();
}
