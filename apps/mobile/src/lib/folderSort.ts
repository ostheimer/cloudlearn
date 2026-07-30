import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Reihenfolge der Ordner-Liste, umschaltbar (#612, Laras Entscheidung 30.07.:
 * „die sollte beides können also auch alphabetisch").
 *
 * Vorher zeigte die App die Server-Reihenfolge (neueste zuerst) und das Web
 * sortierte immer alphabetisch — dasselbe Konto, zwei Reihenfolgen. Jetzt
 * entscheidet die Nutzerin, und die Wahl gilt auf dem Gerät weiter.
 *
 * Voreinstellung ist A–Z (Laras Wahl): Beim Suchen eines Ordners ist der
 * Alphabet-Sprung die verlässlichere Erwartung. Web-Gegenstück:
 * apps/web/src/lib/folder-sort.ts (gleiche Werte, gleicher Schlüssel-Sinn).
 */
export type FolderSort = "alpha" | "recent";

export const DEFAULT_FOLDER_SORT: FolderSort = "alpha";

const STORAGE_KEY = "clearn:folderSort";

/** Unbekannte/fehlende Werte fallen auf die Voreinstellung zurück. */
export function parseFolderSort(raw: string | null | undefined): FolderSort {
  return raw === "recent" || raw === "alpha" ? raw : DEFAULT_FOLDER_SORT;
}

/**
 * Sortiert eine Kopie — die Aufrufer halten ihre Liste im State und dürfen
 * nicht überrascht werden.
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

export async function loadFolderSort(): Promise<FolderSort> {
  try {
    return parseFolderSort(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    // Gesperrter Speicher darf die Liste nicht verhindern.
    return DEFAULT_FOLDER_SORT;
  }
}

export async function saveFolderSort(sort: FolderSort): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, sort);
  } catch {
    // Nicht merken können ist kein Grund, die Umschaltung zu verweigern.
  }
}
