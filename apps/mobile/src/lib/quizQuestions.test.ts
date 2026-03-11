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
});
