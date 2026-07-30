import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Reihenfolge der DECK-Liste, umschaltbar (#614, Laras Auswahl aus Punkt 8).
 *
 * Die Ordner-Liste kann das seit #612 (`folderSort.ts`, A–Z / Neueste). Die
 * Deck-Liste hatte gar keine Wahl: sie zeigte immer die Server-Ordnung
 * (`created_at desc`) — genau der Punkt hinter Laras Rückfrage „gibt es nicht
 * eh schon A–Z?": ja, aber nur für Ordner.
 *
 * Voreinstellung ist „Neueste", weil das die bisherige Ordnung ist: ein Update
 * darf die Bibliothek nicht ohne Zutun umsortieren.
 *
 * Web-Gegenstück: apps/web/src/lib/deck-sort.ts (gleiche Werte, gleiche Regeln,
 * dort localStorage statt AsyncStorage).
 */
export type DeckSort = "created" | "alpha" | "due" | "learned";

export const DEFAULT_DECK_SORT: DeckSort = "created";

const STORAGE_KEY = "clearn:deckSort";

/** Unbekannte/fehlende Werte fallen auf die Voreinstellung zurück. */
export function parseDeckSort(raw: string | null | undefined): DeckSort {
  return raw === "alpha" || raw === "due" || raw === "learned" || raw === "created"
    ? raw
    : DEFAULT_DECK_SORT;
}

export interface SortableDeck {
  id: string;
  title: string;
  createdAt: string;
}

/**
 * Sortiert eine Kopie — die Aufrufer halten ihre Liste im State.
 *
 * Zweitschlüssel ist überall der Titel: bei gleichem Wert (zwei Decks am selben
 * Tag angelegt, zwei ohne fällige Karten, zwei nie gelernte) darf die
 * Reihenfolge nicht bei jedem Rendern springen.
 *
 * „Fällige zuerst" und „Zuletzt gelernt" sind bewusst KEINE Filter: ein Deck
 * ohne fällige Karten verschwindet nicht, es rutscht nach unten.
 */
export function sortDecks<T extends SortableDeck>(
  decks: T[],
  sort: DeckSort,
  context: { dueByDeck?: Record<string, number>; lastLearnedByDeck?: Record<string, string> } = {}
): T[] {
  const copy = [...decks];
  const byTitle = (a: T, b: T) => a.title.localeCompare(b.title, "de");

  if (sort === "alpha") return copy.sort(byTitle);

  if (sort === "due") {
    const due = context.dueByDeck ?? {};
    return copy.sort((a, b) => (due[b.id] ?? 0) - (due[a.id] ?? 0) || byTitle(a, b));
  }

  if (sort === "learned") {
    const learned = context.lastLearnedByDeck ?? {};
    // Nie gelernte Decks haben keinen Zeitstempel und landen hinten — "" ist
    // kleiner als jede ISO-Zeit, absteigend sortiert also ans Ende.
    return copy.sort(
      (a, b) => (learned[b.id] ?? "").localeCompare(learned[a.id] ?? "") || byTitle(a, b)
    );
  }

  // „Neueste": nach createdAt absteigend, nicht auf die Server-Reihenfolge
  // verlassen — ein neu angelegtes Deck wird im State hinten angehängt und
  // stünde sonst fälschlich als ÄLTESTES da (gleiche Falle wie in folderSort).
  return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || byTitle(a, b));
}

export async function loadDeckSort(): Promise<DeckSort> {
  try {
    return parseDeckSort(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    // Gesperrter Speicher darf die Liste nicht verhindern.
    return DEFAULT_DECK_SORT;
  }
}

export async function saveDeckSort(sort: DeckSort): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, sort);
  } catch {
    // Nicht merken können ist kein Grund, die Umschaltung zu verweigern.
  }
}
