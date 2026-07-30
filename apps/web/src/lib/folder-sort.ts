/**
 * Reihenfolge der Ordner-Liste, umschaltbar (#612, Laras Entscheidung 30.07.:
 * „die sollte beides können also auch alphabetisch").
 *
 * Vorher sortierte das Web immer alphabetisch und die App zeigte die
 * Server-Reihenfolge (neueste zuerst) — dasselbe Konto, zwei Reihenfolgen.
 * Voreinstellung ist A–Z (Laras Wahl, und das bisherige Web-Verhalten).
 *
 * App-Gegenstück: apps/mobile/src/lib/folderSort.ts (gleiche Werte, dort
 * AsyncStorage statt localStorage).
 */
export type FolderSort = "alpha" | "recent";

export const DEFAULT_FOLDER_SORT: FolderSort = "alpha";

const STORAGE_KEY = "clearn:folderSort";

/** Unbekannte/fehlende Werte fallen auf die Voreinstellung zurück. */
export function parseFolderSort(raw: string | null | undefined): FolderSort {
  return raw === "recent" || raw === "alpha" ? raw : DEFAULT_FOLDER_SORT;
}

/**
 * Sortiert eine Kopie — die Aufrufer halten ihre Liste im State.
 *
 * „recent" sortiert nach createdAt absteigend statt sich auf die
 * Server-Reihenfolge zu verlassen: Ein neu angelegter Ordner wird im State
 * hinten angehängt, stünde also fälschlich als ÄLTESTER da. Bei gleichem
 * Zeitstempel entscheidet der Titel, damit die Reihenfolge nicht springt.
 */
export function sortFolders<T extends { title: string; createdAt: string }>(
  folders: T[],
  sort: FolderSort
): T[] {
  const copy = [...folders];
  if (sort === "recent") {
    return copy.sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt) || a.title.localeCompare(b.title, "de")
    );
  }
  return copy.sort((a, b) => a.title.localeCompare(b.title, "de"));
}

export function loadFolderSort(): FolderSort {
  if (typeof window === "undefined") return DEFAULT_FOLDER_SORT;
  try {
    return parseFolderSort(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // localStorage kann gesperrt sein (strenger Privatmodus).
    return DEFAULT_FOLDER_SORT;
  }
}

export function saveFolderSort(sort: FolderSort): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, sort);
  } catch {
    // Nicht merken können ist kein Grund, die Umschaltung zu verweigern.
  }
}
