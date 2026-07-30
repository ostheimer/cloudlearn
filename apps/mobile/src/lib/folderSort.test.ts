import { describe, expect, it } from "vitest";
import { DEFAULT_FOLDER_SORT, parseFolderSort, sortFolders } from "./folderSort";

/**
 * Umschaltbare Ordner-Reihenfolge (#612). Vorher sortierte das Web immer
 * alphabetisch und die App zeigte die Server-Reihenfolge — dasselbe Konto, zwei
 * Reihenfolgen. Spiegelt apps/web/src/lib/folder-sort.test.ts.
 */
const folder = (title: string, createdAt: string) => ({ title, createdAt });

describe("sortFolders", () => {
  const folders = [
    folder("Physik", "2026-07-03T10:00:00.000Z"),
    folder("biologie", "2026-07-01T10:00:00.000Z"),
    folder("Änderungen", "2026-07-05T10:00:00.000Z"),
    folder("Deutsch", "2026-07-02T10:00:00.000Z"),
  ];

  it("sortiert A–Z ohne Rücksicht auf Groß-/Kleinschreibung", () => {
    expect(sortFolders(folders, "alpha").map((f) => f.title)).toEqual([
      "Änderungen",
      "biologie",
      "Deutsch",
      "Physik",
    ]);
  });

  it("sortiert Umlaute deutsch ein (Ä bei A, nicht am Ende)", () => {
    const titles = sortFolders(folders, "alpha").map((f) => f.title);
    expect(titles.indexOf("Änderungen")).toBeLessThan(titles.indexOf("biologie"));
  });

  it("sortiert nach Alter mit dem neuesten oben", () => {
    expect(sortFolders(folders, "recent").map((f) => f.title)).toEqual([
      "Änderungen",
      "Physik",
      "Deutsch",
      "biologie",
    ]);
  });

  it("entscheidet bei gleichem Zeitstempel per Titel, damit nichts springt", () => {
    const tie = [
      folder("Zebra", "2026-07-01T10:00:00.000Z"),
      folder("Apfel", "2026-07-01T10:00:00.000Z"),
    ];
    expect(sortFolders(tie, "recent").map((f) => f.title)).toEqual(["Apfel", "Zebra"]);
  });

  it("lässt die übergebene Liste unangetastet", () => {
    const input = [folder("B", "2026-07-02T10:00:00.000Z"), folder("A", "2026-07-01T10:00:00.000Z")];
    sortFolders(input, "alpha");
    expect(input.map((f) => f.title)).toEqual(["B", "A"]);
  });

  it("kommt mit einer leeren Liste zurecht", () => {
    expect(sortFolders([], "alpha")).toEqual([]);
    expect(sortFolders([], "recent")).toEqual([]);
  });
});

describe("parseFolderSort", () => {
  it("nimmt die beiden bekannten Werte an", () => {
    expect(parseFolderSort("alpha")).toBe("alpha");
    expect(parseFolderSort("recent")).toBe("recent");
  });

  it("fällt bei Unsinn, null und leer auf die Voreinstellung zurück", () => {
    // Ein alter oder von Hand verbogener Speicherwert darf die Liste nicht
    // in einen unbekannten Zustand bringen.
    expect(parseFolderSort("quatsch")).toBe(DEFAULT_FOLDER_SORT);
    expect(parseFolderSort(null)).toBe(DEFAULT_FOLDER_SORT);
    expect(parseFolderSort(undefined)).toBe(DEFAULT_FOLDER_SORT);
    expect(parseFolderSort("")).toBe(DEFAULT_FOLDER_SORT);
  });

  it("hat A–Z als Voreinstellung (Laras Wahl 30.07.)", () => {
    expect(DEFAULT_FOLDER_SORT).toBe("alpha");
  });
});
