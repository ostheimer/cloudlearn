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
