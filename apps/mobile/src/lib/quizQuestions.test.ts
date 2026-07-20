import { describe, expect, it } from "vitest";
import { generateQuestions, type QuizCardInput, type QuizCopy } from "./quizQuestions";

// Deterministic PRNG so the generation is reproducible in tests.
function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// The real deck from #380 (f30afafc-…): 20 vocabulary cards sitting next to 21
// image-occlusion cards whose backs are region labels "Bereich 1" … "Bereich 10".
const VOCAB_PAIRS: [string, string][] = [
  ["une forte diminution", "ein starker Rückgang"],
  ["une forte hausse", "ein starker Anstieg"],
  ["la courbe", "die Kurve"],
  ["le graphique", "das Schaubild"],
  ["l'axe", "die Achse"],
  ["le pourcentage", "der Prozentsatz"],
  ["la légende", "die Legende"],
  ["le tableau", "die Tabelle"],
  ["la colonne", "die Spalte"],
  ["la ligne", "die Zeile"],
  ["le sommet", "der Höhepunkt"],
  ["le creux", "der Tiefpunkt"],
  ["la tendance", "die Tendenz"],
  ["la période", "der Zeitraum"],
  ["la source", "die Quelle"],
  ["le titre", "der Titel"],
  ["la moyenne", "der Durchschnitt"],
  ["le total", "die Gesamtsumme"],
  ["la part", "der Anteil"],
  ["l'évolution", "die Entwicklung"],
];

const OCCLUSION_FRONT = "Bild-Occlusion: Was ist an der markierten Stelle?";

const vocabCards: QuizCardInput[] = VOCAB_PAIRS.map(([front, back], i) => ({
  id: `v${i + 1}`,
  front,
  back,
  type: "basic",
}));

const occlusionCards: QuizCardInput[] = Array.from({ length: 21 }, (_, i) => ({
  id: `o${i + 1}`,
  front: OCCLUSION_FRONT,
  back: `Bereich ${(i % 10) + 1}`,
  type: "occlusion",
}));

const mixedDeck: QuizCardInput[] = [...vocabCards, ...occlusionCards];
const vocabBacks = VOCAB_PAIRS.map(([, back]) => back);
const isRegionLabel = (text: string) => /^Bereich \d+$/.test(text);

describe("quizQuestions", () => {
  it("creates image-based questions when cards include markdown images", () => {
    const cards = [
      {
        id: "c1",
        front: "Welches Element ist markiert? ![A](https://example.com/a.png)",
        back: "Button",
      },
      {
        id: "c2",
        front: "Welche Komponente siehst du? ![B](https://example.com/b.png)",
        back: "Card",
      },
      {
        id: "c3",
        front: "Was ist das? ![C](https://example.com/c.png)",
        back: "Modal",
      },
      {
        id: "c4",
        front: "Wie heißt das Element? ![D](https://example.com/d.png)",
        back: "Tooltip",
      },
    ];

    const questions = generateQuestions(cards, 4, undefined, () => 0);
    const imageQuestion = questions.find((q) => q.type === "imageMc");

    expect(imageQuestion).toBeTruthy();
    expect(imageQuestion?.image?.url).toMatch(/^https:\/\/example\.com\/[a-d]\.png$/);
    expect(imageQuestion?.questionText.includes("![")).toBe(false);
    expect(imageQuestion?.options).toHaveLength(4);
  });

  it("never offers a case-only variant of the correct label as an image distractor", () => {
    // The image card's correct label is "Button"; another card carries the same
    // word as "button". A case-only twin must never slip in as a wrong option —
    // that would offer two options meaning the same thing.
    const cards = [
      { id: "c0", front: "Was ist das? ![T](https://example.com/t.png)", back: "Tooltip" },
      { id: "c1", front: "Welches Element? ![X](https://example.com/x.png)", back: "Button" },
      { id: "c2", front: "Und hier? ![Y](https://example.com/y.png)", back: "button" },
      { id: "c3", front: "Wie heißt das? ![C](https://example.com/c.png)", back: "Card" },
      { id: "c4", front: "Was zeigt das Bild? ![M](https://example.com/m.png)", back: "Modal" },
    ];

    // randomFn === 0 rotates the shuffle left by one, so "Button" (c1) is the
    // image question and "button" (c2) sits in the distractor pool.
    const questions = generateQuestions(cards, 5, undefined, () => 0);
    const imageQuestion = questions.find((q) => q.type === "imageMc");

    expect(imageQuestion).toBeTruthy();
    expect(imageQuestion?.correctAnswer).toBe("Button");
    expect(imageQuestion?.options).not.toContain("button");
    expect(imageQuestion?.options.filter((o) => o === "Button")).toHaveLength(1);
  });

  it("uses translated true/false labels from quiz copy", () => {
    const copy: QuizCopy = {
      trueLabel: "True",
      falseLabel: "False",
      trueFalsePrompt: "Is this pair correct?",
      imagePrompt: "Which item is shown?",
    };

    const cards = [
      { id: "1", front: "Front 1", back: "Back 1" },
      { id: "2", front: "Front 2", back: "Back 2" },
      { id: "3", front: "Front 3", back: "Back 3" },
    ];

    const questions = generateQuestions(cards, 3, copy, () => 0);
    const tfQuestion = questions.find((q) => q.type === "trueFalse");

    expect(tfQuestion).toBeTruthy();
    expect(tfQuestion?.questionText).toBe("Is this pair correct?");
    expect(tfQuestion?.options).toEqual(["True", "False"]);
  });

  it("never offers fill-in words as options for normal cards (and vice versa)", () => {
    const cards = [
      { id: "1", front: "sonore", back: "schallend, klangvoll" },
      { id: "2", front: "le record", back: "der Rekord" },
      { id: "3", front: "indispensable", back: "unverzichtbar" },
      { id: "4", front: "Ein Ereignis ohne Vorbild ist: sans ______.", back: "précédent" },
      { id: "5", front: "Das Verb für 'etwas wegwerfen' lautet: ______ qc.", back: "jeter" },
      { id: "6", front: "Einen Rekord schlagen heißt: ______ un record.", back: "battre" },
    ];
    const fillInBacks = ["précédent", "jeter", "battre"];
    const normalBacks = ["schallend, klangvoll", "der Rekord", "unverzichtbar"];

    // Run with several PRNGs so mc and trueFalse paths both get exercised.
    for (const seedStep of [0.05, 0.2, 0.45, 0.7, 0.95]) {
      let state = seedStep;
      const prng = () => {
        state = (state + seedStep) % 1;
        return state;
      };
      const questions = generateQuestions(cards, 12, undefined, prng);
      for (const q of questions) {
        const isFillInCard = ["4", "5", "6"].includes(q.cardId);
        const forbidden = isFillInCard ? normalBacks : fillInBacks;
        for (const opt of q.options) {
          expect(forbidden).not.toContain(opt);
        }
        if (q.tfPairing) {
          expect(forbidden).not.toContain(q.tfPairing.back);
        }
      }
    }
  });

  it("respects the enabled question kinds", () => {
    const cards = [
      { id: "1", front: "le soleil", back: "die Sonne" },
      { id: "2", front: "la lune", back: "der Mond" },
      { id: "3", front: "l'arbre", back: "der Baum" },
    ];
    const tfOnly = generateQuestions(cards, 10, undefined, () => 0.9, {
      allowMc: false,
      allowTrueFalse: true,
    });
    expect(tfOnly.length).toBeGreaterThan(0);
    expect(tfOnly.every((q) => q.type === "trueFalse")).toBe(true);

    const mcOnly = generateQuestions(cards, 10, undefined, () => 0.1, {
      allowMc: true,
      allowTrueFalse: false,
    });
    expect(mcOnly.length).toBeGreaterThan(0);
    expect(mcOnly.every((q) => q.type !== "trueFalse")).toBe(true);

    expect(
      generateQuestions(cards, 10, undefined, () => 0.5, {
        allowMc: false,
        allowTrueFalse: false,
      })
    ).toEqual([]);
  });

  it("reverses direction: question is the back, options come from the fronts", () => {
    const cards = [
      { id: "1", front: "le soleil", back: "die Sonne" },
      { id: "2", front: "la lune", back: "der Mond" },
      { id: "3", front: "l'arbre", back: "der Baum" },
    ];
    const fronts = cards.map((c) => c.front);
    const questions = generateQuestions(cards, 10, undefined, () => 0.9, {
      reverse: true,
      allowMc: true,
      allowTrueFalse: false,
    });
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      const card = cards.find((c) => c.id === q.cardId)!;
      expect(q.questionText).toBe(card.back);
      expect(q.correctAnswer).toBe(card.front);
      for (const opt of q.options) expect(fronts).toContain(opt);
    }
  });

  // #380 — options must come from cards of the SAME KIND only.
  it("never offers occlusion region labels to a vocabulary question (and vice versa)", () => {
    let occlusionQuestions = 0;
    let vocabQuestions = 0;

    for (const seed of [1, 2, 3, 5, 7, 11, 13, 17]) {
      const questions = generateQuestions(mixedDeck, 99, undefined, seeded(seed));
      expect(questions.length).toBeGreaterThan(0);

      for (const q of questions) {
        // True/false shows its pairing; the options are just Richtig/Falsch.
        const shown =
          q.type === "trueFalse" ? [q.tfPairing?.back ?? ""] : [...q.options];
        if (q.cardId.startsWith("o")) {
          occlusionQuestions++;
          for (const option of shown) expect(isRegionLabel(option)).toBe(true);
        } else {
          vocabQuestions++;
          for (const option of shown) {
            expect(isRegionLabel(option)).toBe(false);
            expect(vocabBacks).toContain(option);
          }
        }
      }
    }

    // Guard against a vacuous pass: both kinds really did produce questions.
    expect(occlusionQuestions).toBeGreaterThan(0);
    expect(vocabQuestions).toBeGreaterThan(0);
  });

  it("leaves a pure vocabulary deck exactly as it was before the same-kind filter", () => {
    const pure: QuizCardInput[] = [
      { id: "v1", front: "une forte diminution", back: "ein starker Rückgang" },
      { id: "v2", front: "une forte hausse", back: "ein starker Anstieg" },
      { id: "v3", front: "la courbe", back: "die Kurve" },
      { id: "v4", front: "le graphique", back: "das Schaubild" },
      { id: "v5", front: "la légende", back: "die Legende" },
    ];
    const shape = (qs: ReturnType<typeof generateQuestions>) =>
      qs.map(
        (q) => `${q.cardId}:${q.type}:${q.options.join("/")}:${q.tfPairing?.back ?? ""}`
      );
    // Captured from the generator BEFORE the same-kind filter existed.
    const before = [
      "v2:mc:die Legende/das Schaubild/ein starker Anstieg/die Kurve:",
      "v5:mc:die Kurve/ein starker Rückgang/ein starker Anstieg/die Legende:",
      "v4:trueFalse:Richtig/Falsch:die Kurve",
      "v3:mc:die Legende/ein starker Rückgang/ein starker Anstieg/die Kurve:",
      "v1:mc:ein starker Anstieg/die Legende/das Schaubild/ein starker Rückgang:",
    ];

    const build = (deck: QuizCardInput[]) =>
      generateQuestions(deck, 99, undefined, seeded(42), {
        allowMc: true,
        allowTrueFalse: true,
      });

    // Same result whether the cards carry an explicit type or none at all.
    expect(shape(build(pure))).toEqual(before);
    expect(shape(build(pure.map((c) => ({ ...c, type: "basic" }))))).toEqual(before);
  });

  it("drops a card whose kind has no second answer instead of borrowing foreign options", () => {
    // The quiz mode has no written question type, so the honest fallback for a
    // lone occlusion card is no question at all — never a choice built from
    // vocabulary answers.
    const deck: QuizCardInput[] = [
      ...vocabCards.slice(0, 3),
      { id: "o1", front: OCCLUSION_FRONT, back: "Bereich 1", type: "occlusion" },
    ];
    const questions = generateQuestions(deck, 99, undefined, seeded(9), {
      allowMc: true,
      allowTrueFalse: false,
    });
    expect(questions.find((q) => q.cardId === "o1")).toBeUndefined();
    expect(questions.length).toBeGreaterThan(0);
  });

  it("drops duplicate cards before generating questions", () => {
    const cards = [
      { id: "a1", front: "le soleil", back: "die Sonne" },
      { id: "a2", front: "le soleil", back: "die Sonne" },
      { id: "b", front: "la lune", back: "der Mond" },
      { id: "c", front: "l'arbre", back: "der Baum" },
    ];
    const questions = generateQuestions(cards, 10, undefined, () => 0.99);
    const usedIds = new Set(questions.map((q) => q.cardId));
    // The duplicate pair must yield at most one question.
    expect(usedIds.has("a1") && usedIds.has("a2")).toBe(false);
    expect(questions.length).toBeLessThanOrEqual(3);
  });
});
