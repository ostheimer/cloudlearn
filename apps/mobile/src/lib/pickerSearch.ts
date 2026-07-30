/**
 * Suche in Auswahl-Fenstern (Ordner-/Deck-Picker, #612).
 *
 * Ab PICKER_SEARCH_THRESHOLD Einträgen zeigen die Picker ein Suchfeld —
 * darunter wäre es nur Rauschen. Der Wert gilt auch in den Web-Pickern
 * (AddToFolderModal/AddDecksModal); wer ihn ändert, ändert beide Seiten.
 */
export const PICKER_SEARCH_THRESHOLD = 6;

/** Groß-/Kleinschreibung egal, Leerraum am Rand egal; leere Suche = alles. */
export function filterByTitle<T extends { title: string }>(items: T[], query: string): T[] {
  const q = query.trim().toLocaleLowerCase("de");
  if (!q) return items;
  return items.filter((item) => item.title.toLocaleLowerCase("de").includes(q));
}
