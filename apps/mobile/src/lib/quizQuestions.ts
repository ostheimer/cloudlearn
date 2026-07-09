import { summarizeCardMedia } from "./cardMedia";
import { cleanTerm } from "./cardTerms";

export interface QuizCardInput {
  id: string;
  front: string;
  back: string;
}

export type QuestionType = "mc" | "trueFalse" | "imageMc";

export interface QuizQuestion {
  type: QuestionType;
  cardId: string;
  questionText: string;
  correctAnswer: string;
  options: string[];
  correctIndex: number;
  tfPairing?: { front: string; back: string; isCorrect: boolean };
  image?: { url: string; alt: string };
}

export interface QuizCopy {
  trueLabel: string;
  falseLabel: string;
  trueFalsePrompt: string;
  imagePrompt: string;
}

export const defaultQuizCopyDe: QuizCopy = {
  trueLabel: "Richtig",
  falseLabel: "Falsch",
  trueFalsePrompt: "Stimmt diese Zuordnung?",
  imagePrompt: "Welches Element zeigt das Bild?",
};

function shuffle<T>(arr: T[], randomFn: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    result.push(normalized);
  }
  return result;
}

export function generateQuestions(
  cards: QuizCardInput[],
  count = 10,
  copy: QuizCopy = defaultQuizCopyDe,
  randomFn: () => number = Math.random
): QuizQuestion[] {
  if (cards.length < 2) return [];

  const enriched = cards.map((card) => {
    const media = summarizeCardMedia(card);
    const normalizedFront = cleanTerm(media.plainFront || card.front);
    const normalizedBack = cleanTerm(media.plainBack || card.back);
    const label = media.preferredLabel || normalizedBack || normalizedFront;
    return {
      card,
      media,
      normalizedFront,
      normalizedBack,
      label,
    };
  });

  const questions: QuizQuestion[] = [];
  const shuffledCards = shuffle(enriched, randomFn);
  const limit = Math.min(count, shuffledCards.length);

  for (let i = 0; i < limit; i++) {
    const current = shuffledCards[i]!;
    const hasImage = Boolean(current.media.primaryImage);
    const shouldUseImageQuestion = hasImage && cards.length >= 4 && randomFn() < 0.35;

    if (shouldUseImageQuestion) {
      const correctLabel = current.label;
      const distractors = unique(
        shuffle(
          enriched
            .filter((entry) => entry.card.id !== current.card.id)
            .map((entry) => entry.label),
          randomFn
        )
      ).filter((label) => label !== correctLabel);

      if (correctLabel && distractors.length >= 3 && current.media.primaryImage) {
        const options = shuffle([correctLabel, ...distractors.slice(0, 3)], randomFn);
        questions.push({
          type: "imageMc",
          cardId: current.card.id,
          questionText: current.normalizedFront || copy.imagePrompt,
          correctAnswer: correctLabel,
          options,
          correctIndex: options.indexOf(correctLabel),
          image: {
            url: current.media.primaryImage.url,
            alt: current.media.primaryImage.alt,
          },
        });
        continue;
      }
    }

    const isTF = randomFn() < 0.3 && cards.length >= 3;
    if (isTF) {
      const isCorrect = randomFn() < 0.5;
      const wrongBackPool = unique(
        enriched
          .filter((entry) => entry.card.id !== current.card.id)
          .map((entry) => entry.normalizedBack || entry.label)
      );
      const wrongBack = wrongBackPool[Math.floor(randomFn() * wrongBackPool.length)];
      const displayBack =
        !isCorrect && wrongBack ? wrongBack : current.normalizedBack || current.label;
      const trueFalseQuestion: QuizQuestion = {
        type: "trueFalse",
        cardId: current.card.id,
        questionText: copy.trueFalsePrompt,
        correctAnswer: isCorrect ? copy.trueLabel : copy.falseLabel,
        options: [copy.trueLabel, copy.falseLabel],
        correctIndex: isCorrect ? 0 : 1,
        tfPairing: {
          front: current.normalizedFront || current.label,
          back: displayBack,
          isCorrect,
        },
      };
      if (current.media.primaryImage) {
        trueFalseQuestion.image = {
          url: current.media.primaryImage.url,
          alt: current.media.primaryImage.alt,
        };
      }
      questions.push(trueFalseQuestion);
      continue;
    }

    const wrongBacks = unique(
      shuffle(
        enriched
          .filter((entry) => entry.card.id !== current.card.id)
          .map((entry) => entry.normalizedBack || entry.label),
        randomFn
      )
    ).slice(0, 3);

    const correctAnswer = current.normalizedBack || current.label;
    const options = shuffle([correctAnswer, ...wrongBacks], randomFn);
    const multipleChoiceQuestion: QuizQuestion = {
      type: "mc",
      cardId: current.card.id,
      questionText: current.normalizedFront || copy.imagePrompt,
      correctAnswer,
      options,
      correctIndex: options.indexOf(correctAnswer),
    };
    if (current.media.primaryImage) {
      multipleChoiceQuestion.image = {
        url: current.media.primaryImage.url,
        alt: current.media.primaryImage.alt,
      };
    }
    questions.push(multipleChoiceQuestion);
  }

  return questions;
}
