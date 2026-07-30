/**
 * Die Deck-Zahlen der Ordner-Kacheln aus der gruppierten Server-Antwort (#612).
 *
 * Zwei Seiten zeigen dieselben Kacheln — Bibliothek und Ordnerseite — und beide
 * müssen dieselben drei Fälle gleich behandeln, sonst zeigt die eine "0 Decks",
 * wo die andere "Anzahl unbekannt" sagt:
 *
 *  - Ordner mit Decks       → die Zahl aus der Antwort
 *  - Ordner ohne Decks      → 0. Leere Ordner FEHLEN in der Antwort (gruppierte
 *                             Zählung), ein fehlender Eintrag hieße in der
 *                             Kachel aber "Wird geladen…" — für immer.
 *  - Zählung fehlgeschlagen → -1, was FolderCard als "Anzahl unbekannt" zeigt.
 *                             Lieber ehrlich unbekannt als eine erfundene Null.
 */
export function folderDeckCounts(
  folders: { id: string }[],
  counted: { decksByFolder: Record<string, number> } | null
): Record<string, number> {
  return Object.fromEntries(
    folders.map((f) => [f.id, counted ? (counted.decksByFolder[f.id] ?? 0) : -1])
  );
}
