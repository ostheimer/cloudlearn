// Kacheltexte fürs Zuordnen (#569): dieselbe Aufbereitung wie überall
// (card-display) — Bild-Markdown raus, Übersetzungs-Zusätze raus, und der
// Lückensatz zeigt den Strich statt {{cN::…}}, sonst stünde die Lösung
// sichtbar auf der Frage-Kachel und das Paar wäre geschenkt. Eine reine
// Bild-Seite fällt auf ihre Bild-Beschriftung zurück; bleibt eine Seite
// trotzdem leer, ist die Karte als Text-Kachel nicht spielbar (null).

import { cleanTerm, formatCloze, summarizeCardMedia } from "./card-display";

export function matchTileTexts(card: {
  front: string;
  back: string;
}): { front: string; back: string } | null {
  const media = summarizeCardMedia({ front: card.front || "", back: card.back || "" });
  const front =
    formatCloze(cleanTerm(media.plainFront)).display || media.frontImages[0]?.alt || "";
  const back = cleanTerm(media.plainBack) || media.backImages[0]?.alt || "";
  if (!front.trim() || !back.trim()) return null;
  return { front, back };
}
