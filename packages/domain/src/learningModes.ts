export type LearningMode = "flashcard" | "mcq" | "matching" | "cloze_plus";

export interface AnswerEvaluationInput {
  mode: LearningMode;
  correctAnswer: string | string[];
  userAnswer: string | string[];
}

export interface AnswerEvaluationResult {
  isCorrect: boolean;
  score: number;
  discriminationIndex: number;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function evaluateAnswer(input: AnswerEvaluationInput): AnswerEvaluationResult {
  if (input.mode === "flashcard" || input.mode === "cloze_plus" || input.mode === "mcq") {
    const expected = Array.isArray(input.correctAnswer) ? normalize(input.correctAnswer[0] ?? "") : normalize(input.correctAnswer);
    const actual = Array.isArray(input.userAnswer) ? normalize(input.userAnswer[0] ?? "") : normalize(input.userAnswer);
    const isCorrect = expected === actual;
    return {
      isCorrect,
      score: isCorrect ? 1 : 0,
      discriminationIndex: isCorrect ? 0.7 : 0.3
    };
  }

  const expected = new Set((Array.isArray(input.correctAnswer) ? input.correctAnswer : [input.correctAnswer]).map(normalize));
  const actual = new Set((Array.isArray(input.userAnswer) ? input.userAnswer : [input.userAnswer]).map(normalize));
  const intersection = [...actual].filter((item) => expected.has(item)).length;
  const score = expected.size === 0 ? 0 : intersection / expected.size;
  return {
    isCorrect: score === 1,
    score,
    discriminationIndex: score >= 0.8 ? 0.8 : 0.4
  };
}
