// Welche Teilmenge eines Decks ein Lernmodus abfragt — dieselbe Logik wie in
// der App (apps/mobile/src/components/cardSourcePicker.tsx, filterBySource):
//   all     — jede nutzbare Karte (Standard)
//   starred — nur die markierten (Stern, card.starred === true)
//   wobbly  — nur die „Wackelkandidaten" (am häufigsten falsch, aus der
//             Deck-Statistik: DeckStats.wobblyCards → cardId)
export type CardSource = "all" | "starred" | "wobbly";

/**
 * Filtert eine Kartenliste auf die gewählte Quelle. Reine Funktion (kein React,
 * kein Netz) — damit direkt testbar. `wobblyIds` ist die Menge der
 * Wackelkandidaten-IDs des Decks; ist sie leer, liefert „wobbly" nichts.
 */
export function filterBySource<T extends { id: string; starred?: boolean }>(
  cards: T[],
  source: CardSource,
  wobblyIds: Set<string>
): T[] {
  if (source === "starred") return cards.filter((c) => c.starred === true);
  if (source === "wobbly") return cards.filter((c) => wobblyIds.has(c.id));
  return cards;
}
