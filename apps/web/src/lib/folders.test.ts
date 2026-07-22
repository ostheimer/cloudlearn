import { describe, expect, it } from "vitest";
import { descendantFolders, folderPath, joinTitles } from "./folders";
import type { Folder } from "./api";

function folder(id: string, title: string, parentId: string | null = null): Folder {
  return {
    id,
    userId: "u1",
    title,
    description: null,
    parentId,
    color: null,
    createdAt: "2026-07-16T00:00:00Z",
    updatedAt: "2026-07-16T00:00:00Z"
  };
}

// Schule → Mathematik → Statistik, plus an unrelated top-level folder.
const schule = folder("s", "Schule");
const mathe = folder("m", "Mathematik", "s");
const statistik = folder("st", "Statistik", "m");
const musik = folder("mu", "Musik");
const all = [schule, mathe, statistik, musik];

describe("folderPath", () => {
  it("is empty for a top-level folder", () => {
    expect(folderPath(schule, all)).toEqual([]);
  });

  it("lists ancestors outermost first", () => {
    expect(folderPath(statistik, all)).toEqual(["Schule", "Mathematik"]);
  });

  it("stops when the parent is missing from the list", () => {
    const orphan = folder("o", "Waise", "weg");
    expect(folderPath(orphan, [orphan])).toEqual([]);
  });

  it("terminates on a parent cycle", () => {
    const a = folder("a", "A", "b");
    const b = folder("b", "B", "a");
    expect(folderPath(a, [a, b])).toEqual(["B"]);
  });
});

describe("descendantFolders", () => {
  it("finds nothing below a leaf", () => {
    expect(descendantFolders("st", all)).toEqual([]);
  });

  it("finds children and grandchildren, not siblings", () => {
    const titles = descendantFolders("s", all).map((f) => f.title);
    expect(titles.sort()).toEqual(["Mathematik", "Statistik"]);
  });

  it("terminates on a parent cycle", () => {
    const a = folder("a", "A", "b");
    const b = folder("b", "B", "a");
    expect(descendantFolders("a", [a, b]).map((f) => f.title)).toEqual(["B"]);
  });
});

describe("joinTitles", () => {
  it("returns an empty string for no titles", () => {
    expect(joinTitles([])).toBe("");
  });

  it("leaves a single title alone", () => {
    expect(joinTitles(["Mathematik"])).toBe("Mathematik");
  });

  it("joins the last two with und", () => {
    expect(joinTitles(["Mathematik", "Statistik"])).toBe("Mathematik und Statistik");
    expect(joinTitles(["A", "B", "C"])).toBe("A, B und C");
  });
});
