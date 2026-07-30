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

/**
 * Kurzes Etikett über einer Karte in der Kartenliste (#612).
 *
 * Bild-Occlusion-Karten liefen hier als „Basic" mit, obwohl der Deck-Kopf sie
 * längst getrennt zählt („20 Karten · 10 Bild-Karten") — dieselbe Karte hiess
 * oben Bild-Karte und in der Liste Karteikarte. „Bild-Karte" ist der bereits
 * etablierte Wortlaut (deckCountLabel), „Basic" bleibt für gewöhnliche
 * Karteikarten unverändert.
 */
export function cardKindLabel(type: string | undefined): string {
  if (type === "cloze") return "Lückentext";
  if (type === "occlusion") return "Bild-Karte";
  return "Basic";
}

/**
 * Nachfrage vor dem Löschen einer Karte (#571).
 *
 * Wortgleich mit `cardDeleteQuestion` in apps/web/src/lib/card-display.ts:
 * Laras Entscheidung war die Web-Satzform MIT dem zitierten Kartenanfang der
 * App. Vorher zitierte die App den ROHTEXT (`card.front.slice(0, 50)`) — bei
 * Bild- und Lückenkarten stand damit ![…](…) bzw. {{c1::…}} in der Nachfrage.
 *
 * Der zweite Satz hieß bis zum Papierkorb (#614) „Das lässt sich nicht
 * rückgängig machen." — seither falsch, denn gelöscht wird weich. Hier
 * mitgeändert, damit App und Web wortgleich bleiben (#571). Der
 * Papierkorb-BILDSCHIRM der App kommt mit dem nächsten Build; die Karte selbst
 * ist ab sofort zurückholbar, im Web mit demselben Konto.
 */
export const CARD_QUOTE_MAX = 50;

export function cardDeleteQuestion(card: { front: string; back: string }): string {
  // Genau die Zusammensetzung von `cardListPreview` im Web — nicht
  // `cardSideTexts`: das lässt die Lücke {{c1::…}} bewusst stehen.
  const media = summarizeCardMedia({ front: card.front || "", back: card.back || "" });
  const text = (formatCloze(media.plainFront).display || media.frontImages[0]?.alt || "").trim();
  if (!text) return "Soll diese Karte wirklich gelöscht werden? Sie landet im Papierkorb und lässt sich von dort zurückholen.";
  const quote = text.length > CARD_QUOTE_MAX ? `${text.slice(0, CARD_QUOTE_MAX).trimEnd()}…` : text;
  return `Soll „${quote}" wirklich gelöscht werden? Sie landet im Papierkorb und lässt sich von dort zurückholen.`;
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
