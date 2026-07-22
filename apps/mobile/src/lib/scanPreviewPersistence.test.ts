import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../app/(tabs)/scan.tsx"),
  "utf-8"
);

describe("mobile scan preview persistence (#442)", () => {
  it("generates previews and persists them only through the import save endpoint", () => {
    expect(source).toContain("saveImportedCards(");
    expect(source).not.toMatch(/\bcreateDeck\b/);
    expect(source).not.toMatch(/\bcreateCard\b/);
    expect(source).not.toMatch(/\blistCardsInDeck\b/);
  });
});
