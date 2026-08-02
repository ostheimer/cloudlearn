import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const picker = readFileSync(
  join(mobileRoot, "src/components/TargetDeckPickerModal.tsx"),
  "utf-8"
).replace(/\r\n/g, "\n");
const scan = readFileSync(join(mobileRoot, "app/(tabs)/scan.tsx"), "utf-8").replace(
  /\r\n/g,
  "\n"
);

describe("TargetDeckPickerModal", () => {
  it("kennzeichnet volle Decks für Sprachausgaben als deaktiviert", () => {
    expect(picker).toContain("accessibilityState={{ disabled: isFull }}");
  });

  it("bietet ein neues Deck an, solange die Deck-Grenze es erlaubt", () => {
    expect(picker).toContain("canCreateDeck: boolean");
    expect(picker).toContain("onPress={onCreateDeck}");
    expect(picker).toContain("Neues Deck");
    expect(scan).toContain("canCreateDeck={!deckLimitReached}");
    expect(scan).toContain("onCreateDeck={() => {");
  });
});
