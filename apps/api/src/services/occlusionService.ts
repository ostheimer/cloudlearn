import { z } from "zod";
import { getDeck, listCardsForDeck, saveOcclusionImage } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { getLimitsForTier } from "@/lib/featureGates";
import { assertEntitlement } from "@/lib/limits";
import { getSubscriptionStatus } from "./subscriptionService";

const regionSchema = z.object({
  x: z.number().min(0).max(1), y: z.number().min(0).max(1),
  w: z.number().positive().max(1), h: z.number().positive().max(1),
  label: z.string().trim().min(1).max(200), cardIds: z.array(z.string().uuid()).max(2000),
}).refine(r => r.x + r.w <= 1.000001 && r.y + r.h <= 1.000001, "Region must be inside the image");
const editSchema = z.object({
  userId: z.string().uuid(), deckId: z.string().uuid(),
  sourceImageUrl: z.string().min(1).max(1000).refine(p => !p.includes("://") && !p.startsWith("/")),
  expectedCards: z.array(z.object({ id: z.string().uuid(), back: z.string(), extraData: z.record(z.string(), z.unknown()) })).min(1).max(2000),
  regions: z.array(regionSchema).max(2000),
});

/** One transaction edits a single existing image; retained cards keep all learning fields. */
export async function editOcclusionImageForUser(input: unknown) {
  const parsed = editSchema.parse(input);
  if (!await getDeck(parsed.deckId, parsed.userId)) throw new HttpError("Deck not found", 404, "DECK_NOT_FOUND");
  const cards = await listCardsForDeck(parsed.userId, parsed.deckId);
  const group = cards.filter(c => c.type === "occlusion" && c.sourceImageUrl === parsed.sourceImageUrl);
  const expectedIds = parsed.expectedCards.map(c => c.id);
  if (!group.length || new Set(expectedIds).size !== expectedIds.length || group.length !== expectedIds.length || group.some(c => !expectedIds.includes(c.id))) {
    throw new HttpError("Das Bild wurde inzwischen geändert. Lade es erneut und prüfe deine Änderungen.", 409, "OCCLUSION_CONFLICT");
  }
  const assigned = parsed.regions.flatMap(r => r.cardIds);
  if (new Set(assigned).size !== assigned.length || assigned.some(id => !expectedIds.includes(id))) {
    throw new HttpError("Ungültige Zuordnung der Bereiche.", 400, "INVALID_REGIONS");
  }
  const creates = parsed.regions.filter(r => r.cardIds.length === 0).length;
  const { tier } = await getSubscriptionStatus(parsed.userId);
  if (creates) assertEntitlement(tier, "imageOcclusion");
  return saveOcclusionImage({ ...parsed, maxCards: getLimitsForTier(tier).maxCardsPerDeck });
}
