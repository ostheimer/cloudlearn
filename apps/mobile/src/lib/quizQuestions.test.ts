import { describe, expect, it } from "vitest";
import { generateQuestions, type QuizCopy } from "./quizQuestions";

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
