import { describe, expect, it } from "vitest";
import { evaluateAnswer } from "./learningModes";

describe("evaluateAnswer", () => {
  it("returns full score for correct flashcard answer", () => {
    const result = evaluateAnswer({
      mode: "flashcard",
      correctAnswer: "Hallo",
      userAnswer: "hallo"
    });

    expect(result.isCorrect).toBe(true);
    expect(result.score).toBe(1);
  });

  it("returns partial score for matching mode intersections", () => {
    const result = evaluateAnswer({
      mode: "matching",
      correctAnswer: ["eins", "zwei", "drei"],
      userAnswer: ["eins", "drei", "vier"]
    });

    expect(result.isCorrect).toBe(false);
    expect(result.score).toBeCloseTo(2 / 3);
  });
});
