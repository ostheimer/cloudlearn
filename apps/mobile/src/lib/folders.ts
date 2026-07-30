// Ordner-Baum-Helfer — Spiegel von apps/web/src/lib/folders.ts (#571).
//
// Die App zeigt Unterordner an, nannte beim Löschen aber nie, welche mit
// verschwinden: `parent_id` kaskadiert in der Datenbank, der Bildschirm verrät
// das nicht. Reine Funktionen ohne React/Netz, damit sie testbar bleiben.

export interface FolderLike {
  id: string;
  title: string;
  parentId?: string | null;
}

/**
 * Jeder Ordner unterhalb von `folderId`, in beliebiger Tiefe — genau die, die
 * beim Löschen mitgehen.
 */
export function descendantFolders<T extends FolderLike>(folderId: string, all: T[]): T[] {
  const children = new Map<string, T[]>();
  for (const f of all) {
    if (!f.parentId) continue;
    const list = children.get(f.parentId);
    if (list) list.push(f);
    else children.set(f.parentId, [f]);
  }
  const out: T[] = [];
  const seen = new Set<string>([folderId]);
  const queue = [folderId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    for (const child of children.get(id) ?? []) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      out.push(child);
      queue.push(child.id);
    }
  }
  return out;
}

/** „A, B und C" — Aufzählung in einem Satz. */
export function joinTitles(titles: string[]): string {
  if (titles.length <= 1) return titles[0] ?? "";
  return `${titles.slice(0, -1).join(", ")} und ${titles[titles.length - 1]}`;
}

/**
 * Kopfzeile eines Ordners: „2 Unterordner · 5 Decks · 143 Karten" (#571).
 *
 * Wortgleich mit `buildFolderCountLabel` in apps/web/src/lib/folders.ts. Die
 * App zählte bisher alles zu „7 Einträge" zusammen — das verriet weder, wie
 * viel zu lernen ist, noch dass überhaupt Unterordner drinstecken.
 */
export function buildFolderCountLabel(
  subfolderCount: number,
  deckCount: number,
  cardCount: number
): string {
  const parts: string[] = [];
  if (subfolderCount > 0) parts.push(`${subfolderCount} Unterordner`);
  parts.push(`${deckCount} ${deckCount === 1 ? "Deck" : "Decks"}`);
  if (cardCount > 0) parts.push(`${cardCount} ${cardCount === 1 ? "Karte" : "Karten"}`);
  return parts.join(" · ");
}

/**
 * Nachfrage vor dem Löschen eines Ordners (#571).
 *
 * Wortgleich mit `folderDeleteQuestion` in apps/web/src/lib/folders.ts.
 * Laras Entscheidung: die Web-Fassung überall — als Frage gestellt, die
 * mitgelöschten Unterordner beim Namen genannt und ausdrücklich gesagt, was
 * bleibt. Die App ließ den Nachsatz „Decks bleiben erhalten" auf der
 * Ordnerseite ganz weg und nannte nie einen Unterordner beim Namen.
 */
export function folderDeleteQuestion(title: string, doomedTitles: string[]): string {
  const doomed =
    doomedTitles.length > 0
      ? ` ${joinTitles(doomedTitles)} ${doomedTitles.length === 1 ? "wird" : "werden"} mitgelöscht.`
      : "";
  return `Soll „${title}" wirklich gelöscht werden?${doomed} Deine Decks und Karten bleiben erhalten.`;
}
