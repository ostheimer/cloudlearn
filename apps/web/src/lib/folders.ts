import type { Folder } from "./api";

/**
 * The web library lists every folder flat, including ones nested in the app.
 * These helpers recover the tree facts the flat list would otherwise hide.
 */

/** Ancestor titles, outermost first. Empty for a top-level folder. */
export function folderPath(folder: Folder, all: Folder[]): string[] {
  const byId = new Map(all.map((f) => [f.id, f]));
  const path: string[] = [];
  const seen = new Set<string>([folder.id]);
  let parentId = folder.parentId;
  while (parentId && !seen.has(parentId)) {
    const parent = byId.get(parentId);
    if (!parent) break;
    seen.add(parent.id);
    path.unshift(parent.title);
    parentId = parent.parentId;
  }
  return path;
}

/**
 * Every folder below `folderId`, at any depth. The database cascades deletes
 * along parent_id, so these disappear with it — the delete dialog names them.
 */
export function descendantFolders(folderId: string, all: Folder[]): Folder[] {
  const children = new Map<string, Folder[]>();
  for (const f of all) {
    if (!f.parentId) continue;
    const list = children.get(f.parentId);
    if (list) list.push(f);
    else children.set(f.parentId, [f]);
  }
  const out: Folder[] = [];
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

/** "Mathematik und Statistik" — for prose, not lists. */
export function joinTitles(titles: string[]): string {
  if (titles.length <= 1) return titles[0] ?? "";
  return `${titles.slice(0, -1).join(", ")} und ${titles[titles.length - 1]}`;
}

/**
 * Kopfzeile eines Ordners: „2 Unterordner · 5 Decks · 143 Karten" (#571).
 *
 * Wortgleich mit `buildFolderCountLabel` in apps/mobile/src/lib/folders.ts.
 * Die App zählte alles zu „7 Einträge" zusammen — das verriet weder, wie viel
 * zu lernen ist, noch dass überhaupt Unterordner drinstecken. Leere Teile
 * fallen weg; die Deck-Zahl steht immer da, auch bei 0, damit ein Ordner ohne
 * Decks nicht ohne jede Zeile dasteht.
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
 * Wortgleich mit `folderDeleteQuestion` in apps/mobile/src/lib/folders.ts.
 * Laras Entscheidung: die Web-Fassung überall — als Frage gestellt, die
 * mitgelöschten Unterordner beim Namen genannt (parent_id kaskadiert in der
 * Datenbank, der Baum verrät das sonst nicht) und ausdrücklich gesagt, was
 * bleibt. Die App ließ diesen Nachsatz auf der Ordnerseite ganz weg.
 */
export function folderDeleteQuestion(title: string, doomedTitles: string[]): string {
  const doomed =
    doomedTitles.length > 0
      ? ` ${joinTitles(doomedTitles)} ${doomedTitles.length === 1 ? "wird" : "werden"} mitgelöscht.`
      : "";
  return `Soll „${title}" wirklich gelöscht werden?${doomed} Deine Decks und Karten bleiben erhalten.`;
}
