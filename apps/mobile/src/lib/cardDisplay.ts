// Display preparation for raw card texts — mirror of the web's card-display.ts
// and match-tiles.ts (#569/#592), built on the existing helpers cardMedia,
// cardTerms and cloze: image markdown is separated from the text (a side that
// is only an image falls back to its caption), translation wrappers disappear.
// Raw ![…](…) code must never reach a question, an option or a tile.

import { summarizeCardMedia, type CardMediaSummary } from "./cardMedia";
import { cleanTerm } from "./cardTerms";
import { formatCloze } from "./cloze";

export interface CardSideTexts {
  front: string;
  back: string;
  media: CardMediaSummary;
}

// The displayable text of each side. `front`/`back` never contain image
// markdown; a side consisting only of an image yields its caption — or ""
// when the image has none. A {{cN::…}} gap stays in the text (callers decide
// when to turn it into the blank via formatCloze).
export function cardSideTexts(card: { front: string; back: string }): CardSideTexts {
  const media = summarizeCardMedia({ front: card.front || "", back: card.back || "" });
  const front = cleanTerm(media.plainFront) || media.frontImages[0]?.alt || "";
  const back = cleanTerm(media.plainBack) || media.backImages[0]?.alt || "";
  return { front, back, media };
}

// Tile texts for the matching mode — like the web (match-tiles.ts): the front
// of a cloze card shows its gap as a blank, because the raw {{cN::…}} would
// print the matching back right on the question tile. A side left without any
// text cannot be a text tile, so the card is not playable (null).
export function matchTileTexts(card: {
  front: string;
  back: string;
}): { front: string; back: string } | null {
  const sides = cardSideTexts(card);
  const front = formatCloze(sides.front).display;
  if (!front.trim() || !sides.back.trim()) return null;
  return { front, back: sides.back };
}
