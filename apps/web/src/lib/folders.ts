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
