import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cardEditorErrorMessage } from "./cardEditorError";

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel: string) =>
  readFileSync(join(mobileRoot, rel), "utf-8").replace(/\r\n/g, "\n");

const DIFFICULTY_SCREENS = [
  "app/(tabs)/learn.tsx",
  "app/cloze.tsx",
  "app/quiz.tsx",
  "app/test.tsx",
];

for (const rel of DIFFICULTY_SCREENS) {
  describe(`${rel} – Karteneditor`, () => {
    const source = read(rel);
    const editor = source.slice(source.lastIndexOf("<CardEditor"));

    it("öffnet mit der echten Schwierigkeit und speichert eine Änderung", () => {
      expect(editor).not.toContain('difficulty: "medium"');
      expect(editor).toMatch(/difficulty:\s*(?:current|raw)\.difficulty/);
      expect(editor).toMatch(/onSave=\{async \(\{ front, back, difficulty \}\)/);
      expect(editor).toMatch(
        /updateCard\([\s\S]*?\{[\s\S]*?front,[\s\S]*?back,[\s\S]*?difficulty[\s\S]*?\}\)/
      );
    });
  });
}

const EDITOR_SCREENS = [...DIFFICULTY_SCREENS, "app/match.tsx"];

for (const rel of EDITOR_SCREENS) {
  describe(`${rel} – bedienbarer Karteneditor`, () => {
    const source = read(rel);
    const editor = source.slice(source.lastIndexOf("<CardEditor"));

    it("zeigt einen Speicherfehler im offenen Editor", () => {
      expect(source).toContain("setCardEditorError(cardEditorErrorMessage(error));");
      expect(editor).toContain("error={cardEditorError}");
    });

    it("benennt Stift und Stern für die Sprachausgabe", () => {
      expect(source).toContain('accessibilityLabel="Karte bearbeiten"');
      expect(source).toContain('"Markierung entfernen"');
      expect(source).toContain('"Karte markieren"');
    });
  });
}

describe("CardEditor", () => {
  const source = read("src/components/CardEditor.tsx");

  it("rendert den Fehler als Live-Hinweis", () => {
    expect(source).toContain("error?: string | null");
    expect(source).toContain("accessibilityRole=\"alert\"");
    expect(source).toContain("{error}");
  });
});

describe("cardEditorErrorMessage", () => {
  it("erklärt eine Deck-Grenze statt zu einem aussichtslosen Retry aufzufordern", () => {
    expect(
      cardEditorErrorMessage({
        code: "DECK_FULL",
        message: "In diesem Tarif sind höchstens 100 Karten erlaubt.",
      })
    ).toBe("In diesem Tarif sind höchstens 100 Karten erlaubt.");
  });

  it("gibt bei einem gewöhnlichen Fehler einen klaren Retry-Hinweis", () => {
    expect(cardEditorErrorMessage(new Error("offline"))).toBe(
      "Speichern fehlgeschlagen. Bitte versuche es erneut."
    );
  });
});
