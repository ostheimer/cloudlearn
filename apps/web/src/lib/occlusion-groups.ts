import type { Card } from "./api";
import type { OcclusionRegion } from "./card-images";

type ImageCard = Pick<Card, "id" | "type" | "back" | "sourceImageUrl" | "extraData">;
export type EditableRegion = OcclusionRegion & { label: string; cardIds: string[] };
export type OcclusionImageGroup = { path: string; cards: ImageCard[]; regions: EditableRegion[]; editable: boolean };

export function groupOcclusionImages(cards: ImageCard[]): OcclusionImageGroup[] {
  const groups = new Map<string, OcclusionImageGroup>();
  for (const card of cards) {
    if (card.type !== "occlusion" || !card.sourceImageUrl) continue;
    const group = groups.get(card.sourceImageUrl) ?? { path: card.sourceImageUrl, cards: [], regions: [], editable: true };
    groups.set(group.path, group);
    group.cards.push(card);
    const data = card.extraData;
    const index = data?.hideIndex ?? 0;
    const target = Array.isArray(data?.regions) && Number.isInteger(index) ? data.regions[index as number] as OcclusionRegion | undefined : undefined;
    if (!target || ![target.x, target.y, target.w, target.h].every(n => typeof n === "number" && Number.isFinite(n)) ||
      target.x < 0 || target.y < 0 || target.w <= 0 || target.h <= 0 || target.x + target.w > 1.000001 || target.y + target.h > 1.000001) {
      group.editable = false;
      continue;
    }
    const label = card.back.trim() || target.label || `Bereich ${group.regions.length + 1}`;
    const existing = group.regions.find(r => r.x === target.x && r.y === target.y && r.w === target.w && r.h === target.h && r.label === label);
    if (existing) existing.cardIds.push(card.id);
    else group.regions.push({ x: target.x, y: target.y, w: target.w, h: target.h, label, cardIds: [card.id] });
  }
  return [...groups.values()];
}
