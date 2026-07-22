/**
 * Auswahl-Reihenfolge für den Deck-Wähler des Ordners (#437-Nachschliff).
 *
 * Ein Array statt eines Set, weil die REIHENFOLGE die halbe Funktion ist:
 * Antippen hängt hinten an (bekommt die nächste Nummer), Abwählen entfernt —
 * und alle späteren rücken dadurch automatisch auf. Die Position im Array IST
 * die angezeigte Nummer minus eins, es gibt keinen zweiten Zähler, der
 * auseinanderlaufen könnte.
 */
export function toggleSelection(selected: string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
}
