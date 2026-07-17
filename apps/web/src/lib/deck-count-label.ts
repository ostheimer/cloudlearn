/**
 * "20 Karten · 10 Bild-Karten" — die eine Regel, wie die Größe eines Decks
 * benannt wird. Vorher rechnete jede Stelle selbst: die Deck-Ansicht teilte
 * schon auf, die Deck-Liste und die Ordner-Seite zeigten nur die Text-Karten.
 * Ein Deck NUR mit Bild-Karten meldete dort „0 Karten" und wirkte kaputt,
 * obwohl die Karten da sind — sie gehören nur in den Bild-Abdecken-Modus.
 *
 * Ein Teil, der null ist, wird weggelassen: „0 Karten · 10 Bild-Karten" liest
 * sich, als wäre das Deck leer. Sind beide null, gibt es kein Label — der
 * Leerzustand des Bildschirms sagt das ohnehin schon.
 */
export function deckCountLabel(
  cardCount: number | undefined,
  imageCardCount: number | undefined
): string | null {
  const cards = cardCount ?? 0;
  const images = imageCardCount ?? 0;
  const parts: string[] = [];
  if (cards > 0) parts.push(`${cards} ${cards === 1 ? "Karte" : "Karten"}`);
  if (images > 0) parts.push(`${images} Bild-${images === 1 ? "Karte" : "Karten"}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
