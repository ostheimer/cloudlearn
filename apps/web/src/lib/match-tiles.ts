import { cleanTerm, formatCloze, summarizeCardMedia, type MarkdownImage } from "./card-display";

type MatchCard = { front: string; back: string; type?: string };
export interface MatchSide { text: string; images: MarkdownImage[] }

export function matchTileMedia(card: MatchCard): { front: MatchSide; back: MatchSide } | null {
  if (card.type === "occlusion") return null;
  const media = summarizeCardMedia(card);
  const front = { text: formatCloze(cleanTerm(media.plainFront)).display, images: media.frontImages };
  const back = { text: cleanTerm(media.plainBack), images: media.backImages };
  if ((!front.text.trim() && !front.images.length) || (!back.text.trim() && !back.images.length)) return null;
  return { front, back };
}

// Kept for callers that need only the prepared text/caption.
export function matchTileTexts(card: MatchCard): { front: string; back: string } | null {
  const sides = matchTileMedia(card);
  return sides ? {
    front: sides.front.text || sides.front.images[0]?.alt || "",
    back: sides.back.text || sides.back.images[0]?.alt || "",
  } : null;
}
