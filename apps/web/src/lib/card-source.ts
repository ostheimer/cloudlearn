// Welche Teilmenge eines Decks ein Lernmodus abfragt — dieselbe Logik wie in
// der App (apps/mobile/src/components/cardSourcePicker.tsx, filterBySource):
//   due     — nur die heute fälligen (fsrsDue erreicht; dieselbe Regel, mit
//             der der Server „N fällig" zählt: fsrs_due <= jetzt, #610)
//   all     — jede nutzbare Karte (Standard)
//   starred — nur die markierten (Stern, card.starred === true)
//   wobbly  — nur die „Wackelkandidaten" (am häufigsten falsch, aus der
//             Deck-Statistik: DeckStats.wobblyCards → cardId)
export type CardSource = "all" | "starred" | "wobbly" | "due";

/**
 * Ist die Karte fällig? Fällig heißt: Der vom Lernplan geplante
 * Wiederhol-Zeitpunkt ist erreicht — neue Karten sind es sofort (ihr
 * fsrsDue ist der Anlegezeitpunkt). Karten ohne Fälligkeitsdatum (z. B.
 * abgespeckte Kartenobjekte) zählen nie als fällig.
 */
export function isCardDue(
  card: { fsrsDue?: string },
  now: number = Date.now()
): boolean {
  if (!card.fsrsDue) return false;
  const due = new Date(card.fsrsDue).getTime();
  return Number.isFinite(due) && due <= now;
}

/**
 * Filtert eine Kartenliste auf die gewählte Quelle. Reine Funktion (kein React,
 * kein Netz) — damit direkt testbar. `wobblyIds` ist die Menge der
 * Wackelkandidaten-IDs des Decks; ist sie leer, liefert „wobbly" nichts.
 * `now` ist nur für Tests übersteuerbar.
 */
export function filterBySource<T extends { id: string; starred?: boolean; fsrsDue?: string }>(
  cards: T[],
  source: CardSource,
  wobblyIds: Set<string>,
  now: number = Date.now()
): T[] {
  if (source === "starred") return cards.filter((c) => c.starred === true);
  if (source === "wobbly") return cards.filter((c) => wobblyIds.has(c.id));
  if (source === "due") return cards.filter((c) => isCardDue(c, now));
  return cards;
}
