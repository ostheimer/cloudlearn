import type { Flashcard } from "./api";

/**
 * Reine Helfer für die Karten-Vorschau nach dem Scan (#427). Der Bearbeiten-/
 * Löschen-Zustand steckt bewusst NICHT in der großen Scan-Komponente, damit die
 * Array-Logik für sich prüfbar ist — die Komponente ruft nur setCards damit auf.
 */

/** Ersetzt Vorder- oder Rückseite EINER Karte, lässt die anderen unberührt. */
export function editCardField(
  cards: Flashcard[],
  index: number,
  side: "front" | "back",
  value: string
): Flashcard[] {
  return cards.map((card, i) => (i === index ? { ...card, [side]: value } : card));
}

/** Entfernt genau eine Karte; die Reihenfolge der übrigen bleibt erhalten. */
export function removeCardAt(cards: Flashcard[], index: number): Flashcard[] {
  return cards.filter((_card, i) => i !== index);
}

/**
 * Ob eine Karte in der Vorschau frei bearbeitbar ist. Nur schlichte Text-Karten:
 * Bild-Karten und Lückentext ({{c1::…}}) haben Struktur, die ein einfaches
 * Textfeld zerstören würde — die bleiben les-, aber löschbar.
 */
export function isPlainEditableCard(card: {
  front: string;
  hasMedia?: boolean;
}): boolean {
  if (card.hasMedia) return false;
  return !/\{\{c\d+::/.test(card.front);
}
