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
 *
 * Nimmt bewusst die fertige Medien-Zusammenfassung (summarizeCardMedia) und
 * fragt NUR `primaryImage` ab. Der erste Anlauf (#456) prüfte stattdessen, ob
 * `plainFront`/`plainBack` gesetzt sind — die sind aber IMMER gesetzt (die
 * bereinigte Textfassung jeder Karte), also galt jede Karte als „hat Medien"
 * und keine wurde je editierbar. Am Gerät fiel es auf, in den Unit-Tests nicht,
 * weil die dort das Flag von Hand setzten. Deshalb bekommt diese Funktion jetzt
 * die echte Zusammenfassung und wird mit deren echter Ausgabe getestet.
 */
export function isCardEditable(
  card: { front: string },
  media: { primaryImage: unknown }
): boolean {
  if (media.primaryImage) return false; // Bild-Karte
  return !/\{\{c\d+::/.test(card.front); // Lückentext
}
