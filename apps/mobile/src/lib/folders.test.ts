import { describe, expect, it } from "vitest";
import {
  buildFolderCountLabel,
  descendantFolders,
  folderDeleteQuestion,
  joinTitles,
  type FolderLike,
} from "./folders";

function folder(id: string, title: string, parentId: string | null = null): FolderLike {
  return { id, title, parentId };
}

describe("descendantFolders", () => {
  it("collects subfolders at every depth", () => {
    const all = [
      folder("s", "Schule"),
      folder("m", "Mathematik", "s"),
      folder("st", "Statistik", "m"),
      folder("x", "Anderes"),
    ];
    expect(
      descendantFolders("s", all)
        .map((f) => f.title)
        .sort()
    ).toEqual(["Mathematik", "Statistik"]);
  });

  it("terminates on a parent cycle", () => {
    const a = folder("a", "A", "b");
    const b = folder("b", "B", "a");
    expect(descendantFolders("a", [a, b]).map((f) => f.title)).toEqual(["B"]);
  });
});

describe("joinTitles", () => {
  it("joins the last two with und", () => {
    expect(joinTitles([])).toBe("");
    expect(joinTitles(["Mathematik"])).toBe("Mathematik");
    expect(joinTitles(["A", "B", "C"])).toBe("A, B und C");
  });
});

// Beide Wortlaute müssen zum Web passen (apps/web/src/lib/folders.test.ts) —
// dieselben Erwartungen stehen dort noch einmal.
describe("buildFolderCountLabel", () => {
  it("names subfolders, decks and cards", () => {
    expect(buildFolderCountLabel(2, 5, 143)).toBe("2 Unterordner · 5 Decks · 143 Karten");
  });

  it("leaves out subfolders and cards when there are none, but keeps the deck count", () => {
    expect(buildFolderCountLabel(0, 3, 0)).toBe("3 Decks");
    expect(buildFolderCountLabel(0, 0, 0)).toBe("0 Decks");
  });

  it("uses the singular where German needs it", () => {
    expect(buildFolderCountLabel(1, 1, 1)).toBe("1 Unterordner · 1 Deck · 1 Karte");
  });
});

describe("folderDeleteQuestion", () => {
  it("asks, names the doomed subfolders and says what survives", () => {
    expect(folderDeleteQuestion("Schule", ["Bio", "Chemie"])).toBe(
      'Soll „Schule" wirklich gelöscht werden? Bio und Chemie werden mitgelöscht. Deine Decks und Karten bleiben erhalten.'
    );
  });

  it("uses the singular verb for a single subfolder", () => {
    expect(folderDeleteQuestion("Schule", ["Bio"])).toContain("Bio wird mitgelöscht.");
  });

  it("skips the subfolder sentence when the folder has none", () => {
    expect(folderDeleteQuestion("Schule", [])).toBe(
      'Soll „Schule" wirklich gelöscht werden? Deine Decks und Karten bleiben erhalten.'
    );
  });
});
