/**
 * "20 Karten · 10 Bild-Karten" — die eine Regel, wie die Größe eines Decks
 * benannt wird. Vorher rechnete jede Stelle selbst, und die Zahlen widersprachen
 * sich: Die Bibliothek zeigte 20 (Server zählt ohne Occlusion), die Deck-Ansicht
 * 30 (alles). Dasselbe Deck, zwei Wahrheiten.
 *
 * Ein Teil, der null ist, wird weggelassen: „0 Karten · 10 Bild-Karten" liest
 * sich, als wäre das Deck leer. Sind beide null, gibt es kein Label — der
 * Leerzustand des Bildschirms sagt das ohnehin.
 *
 * Wortgleich mit der Website (apps/web/src/lib/deck-count-label.ts). Bewusst
 * eine eigene Kopie statt eines geteilten Pakets: App und Website werden
 * getrennt ausgeliefert (vgl. #78) — die Formulierung muss aber übereinstimmen,
 * sonst heißt dasselbe Ding in der App anders als im Web.
 */
export function buildDeckCountLabel(
  cardCount: number | undefined,
  imageCardCount: number | undefined,
  maxCardsPerDeck?: number | null
): string | null {
  const cards = cardCount ?? 0;
  const images = imageCardCount ?? 0;
  const parts: string[] = [];
  if (typeof maxCardsPerDeck === "number") {
    // Füllstand statt reiner Anzahl (#611): „142 von 150 Karten" sagt vor dem
    // Tippen, wie viel Platz bleibt. Bild-Karten zählen in die Summe links vom
    // „von", weil der Server sie beim Durchsetzen der Grenze mitzählt — sie
    // bleiben rechts zusätzlich ausgewiesen, damit die Aufteilung sichtbar ist.
    parts.push(`${cards + images} von ${maxCardsPerDeck} Karten`);
    if (images > 0) parts.push(`${images} Bild-${images === 1 ? "Karte" : "Karten"}`);
    return parts.join(" · ");
  }
  if (cards > 0) parts.push(`${cards} ${cards === 1 ? "Karte" : "Karten"}`);
  if (images > 0) parts.push(`${images} Bild-${images === 1 ? "Karte" : "Karten"}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
