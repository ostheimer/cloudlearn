import { describe, expect, it } from "vitest";
import { normalizeTranslationDirection } from "@/lib/translationDirection";
import { flashcardListSchema } from "@/lib/contracts";

function card(front: string, back: string, frontLang: string, backLang: string, type = "basic") {
  return { front, back, type, difficulty: "medium", tags: [], frontLang, backLang };
}

const fr = (front: string, back: string) => card(front, back, "fr", "de");
const de = (front: string, back: string) => card(front, back, "de", "fr");

describe("normalizeTranslationDirection", () => {
  // The deck that surfaced the bug: 16 rows fr→de, 4 rows de→fr, so the quiz
  // drew both French and German answers from the "back" column.
  it("flips the minority direction of a mixed vocabulary deck", () => {
    const deck = [
      fr("les données", "die Daten"),
      de("aus dem Diagramm geht hervor, dass", "du diagramme il résulte que"),
      fr("la moitié (de)", "die Hälfte"),
      de("man muss berücksichtigen", "on doit prendre en considération"),
      fr("une forte diminution", "ein starker Rückgang"),
      fr("en outre", "zudem / außerdem"),
    ];

    const normalized = normalizeTranslationDirection(deck);

    expect(normalized.every((c) => c.frontLang === "fr" && c.backLang === "de")).toBe(true);
    expect(normalized[1]).toMatchObject({
      front: "du diagramme il résulte que",
      back: "aus dem Diagramm geht hervor, dass",
    });
    expect(normalized[3]).toMatchObject({
      front: "on doit prendre en considération",
      back: "man muss berücksichtigen",
    });
    // Cards already facing the majority way are untouched.
    expect(normalized[0]).toMatchObject({ front: "les données", back: "die Daten" });
  });

  it("leaves a deck alone when no direction has a majority", () => {
    const deck = [fr("en outre", "zudem"), de("die Daten", "les données")];
    expect(normalizeTranslationDirection(deck)).toEqual(deck);
  });

  it("keeps non-translation cards untouched", () => {
    const deck = [
      card("Was ist ein Mitochondrium?", "Das Kraftwerk der Zelle", "de", "de"),
      card("Bild-Occlusion: markierte Stelle?", "Bereich 1", "de", "de"),
      fr("les données", "die Daten"),
      fr("la moitié (de)", "die Hälfte"),
      de("beliebter als", "plus apprécié/e/s que"),
    ];

    const normalized = normalizeTranslationDirection(deck);

    expect(normalized[0]).toEqual(deck[0]);
    expect(normalized[1]).toEqual(deck[1]);
    expect(normalized[4]).toMatchObject({ front: "plus apprécié/e/s que", back: "beliebter als" });
  });

  // Flipping these would destroy them: the gap sentence belongs on the front and
  // the image would move to the back.
  it("never flips gap or image cards even against the majority", () => {
    const gap = card("La capitale est ______.", "Paris", "fr", "fr", "cloze");
    const clozeMarker = card("Le résultat est {{c1::élevé}}.", "élevé", "fr", "fr", "cloze");
    const image = card("![Diagramm](https://example.com/a.png)", "le graphique", "de", "fr");
    const deck = [fr("les données", "die Daten"), fr("en outre", "zudem"), gap, clozeMarker, image];

    const normalized = normalizeTranslationDirection(deck);

    expect(normalized[2]).toEqual(gap);
    expect(normalized[3]).toEqual(clozeMarker);
    expect(normalized[4]).toEqual(image);
  });

  // A wrong flip is worse than no flip, so anything but a clean ISO 639-1 code
  // counts as unlabelled.
  it("ignores unusable or missing language labels", () => {
    const unlabelled = { front: "en outre", back: "zudem", type: "basic" };
    const deck = [
      fr("les données", "die Daten"),
      fr("la moitié (de)", "die Hälfte"),
      card("beliebter als", "plus apprécié/e/s que", "German", "French"),
      card("die Hälfte", "la moitié", "", ""),
      unlabelled,
    ];

    const normalized = normalizeTranslationDirection(deck);

    expect(normalized[2]).toMatchObject({ front: "beliebter als" });
    expect(normalized[3]).toMatchObject({ front: "die Hälfte" });
    expect(normalized[4]).toEqual(unlabelled);
  });

  it("normalizes each language pair separately and accepts regional codes", () => {
    const deck = [
      card("les données", "die Daten", "fr-FR", "de-DE"),
      card("aus dem Diagramm", "du diagramme", "de", "fr"),
      card("the data", "die Daten", "en", "de"),
      card("the half", "die Hälfte", "en", "de"),
      card("die Daten", "the data", "de", "en"),
    ];

    const normalized = normalizeTranslationDirection(deck);

    // fr|de: 1 vs 1 is a tie — untouched. en|de: 2 vs 1 — the outlier flips.
    expect(normalized[1]).toMatchObject({ front: "aus dem Diagramm" });
    expect(normalized[4]).toMatchObject({ front: "the data", back: "die Daten" });
  });

  // The language labels are a transport detail for this check — they must not
  // reach the database.
  it("does not leak language labels into the stored card", () => {
    const normalized = normalizeTranslationDirection([
      fr("les données", "die Daten"),
      fr("la moitié (de)", "die Hälfte"),
      de("beliebter als", "plus apprécié/e/s que"),
    ]);

    const stored = flashcardListSchema.parse(normalized);

    expect(stored[2]).toEqual({
      front: "plus apprécié/e/s que",
      back: "beliebter als",
      type: "basic",
      difficulty: "medium",
      tags: [],
    });
  });
});
