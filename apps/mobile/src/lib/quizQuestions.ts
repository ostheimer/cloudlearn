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

// A fill-in card is a sentence with a gap ("______" or a {{cN::…}} cloze). Its
// back is the missing word — usually in the deck's *front* language — so its
// back must never be offered as an option for a normal card, and vice versa.
function isFillIn(text: string): boolean {
  return /_{2,}/.test(text) || /\{\{c\d+::/.test(text);
}

export interface GenerateOptions {
  // Ask back → front for normal cards (fill-in cards keep their gap sentence).
  reverse?: boolean;
  // Question kinds the learner enabled — at least one should be true.
  allowMc?: boolean;
  allowTrueFalse?: boolean;
}

export function generateQuestions(
  cards: QuizCardInput[],
  count = 10,
  copy: QuizCopy = defaultQuizCopyDe,
  randomFn: () => number = Math.random,
  opts: GenerateOptions = {}
): QuizQuestion[] {
  if (cards.length < 2) return [];
  const reverse = opts.reverse ?? false;
  const allowMc = opts.allowMc ?? true;
  const allowTrueFalse = opts.allowTrueFalse ?? true;
  if (!allowMc && !allowTrueFalse) return [];

  const seenPairs = new Set<string>();
  const enriched = cards.flatMap((card) => {
    const media = summarizeCardMedia(card);
    const normalizedFront = cleanTerm(media.plainFront || card.front);
    const normalizedBack = cleanTerm(media.plainBack || card.back);
    // Decks sometimes hold each card twice (double scans) — drop duplicates.
    const key = `${normalizedFront}|${normalizedBack}`.toLowerCase();
    if (seenPairs.has(key)) return [];
    seenPairs.add(key);
    const label = media.preferredLabel || normalizedBack || normalizedFront;
    const fillIn = isFillIn(normalizedFront);
    // Question/answer side follows the direction; fill-in cards always show
    // their gap sentence and expect the missing word.
    const questionSide =
      fillIn || !reverse ? normalizedFront : normalizedBack;
    const answerSide = fillIn || !reverse ? normalizedBack : normalizedFront;
    return [
      {
        card,
        media,
        normalizedFront,
        normalizedBack,
        label,
        fillIn,
        questionSide,
        answerSide,
      },
    ];
  });

  const questions: QuizQuestion[] = [];
  const shuffledCards = shuffle(enriched, randomFn);
  const limit = Math.min(count, shuffledCards.length);

  for (let i = 0; i < limit; i++) {
    const current = shuffledCards[i]!;
    const hasImage = Boolean(current.media.primaryImage);
    const shouldUseImageQuestion =
      allowMc && hasImage && cards.length >= 4 && randomFn() < 0.35;

    if (shouldUseImageQuestion) {
      const correctLabel = current.label;
      const distractors = unique(
        shuffle(
          enriched
            .filter(
              (entry) =>
                entry.card.id !== current.card.id &&
                entry.fillIn === current.fillIn
            )
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

    const isTF =
      allowTrueFalse && (!allowMc || (randomFn() < 0.3 && cards.length >= 3));
    if (isTF) {
      const isCorrect = randomFn() < 0.5;
      const ownAnswer = (current.answerSide || current.label).toLowerCase();
      const wrongAnswerPool = unique(
        enriched
          .filter(
            (entry) =>
              entry.card.id !== current.card.id &&
              entry.fillIn === current.fillIn
          )
          .map((entry) => entry.answerSide || entry.label)
      ).filter((a) => a.toLowerCase() !== ownAnswer);
      const wrongAnswer =
        wrongAnswerPool[Math.floor(randomFn() * wrongAnswerPool.length)];
      // Without a same-kind wrong candidate the shown pairing is inevitably the
      // correct one — grade it as such instead of demanding "Falsch".
      const effectiveIsCorrect = isCorrect || !wrongAnswer;
      const displayAnswer =
        !effectiveIsCorrect && wrongAnswer
          ? wrongAnswer
          : current.answerSide || current.label;
      const trueFalseQuestion: QuizQuestion = {
        type: "trueFalse",
        cardId: current.card.id,
        questionText: copy.trueFalsePrompt,
        correctAnswer: effectiveIsCorrect ? copy.trueLabel : copy.falseLabel,
        options: [copy.trueLabel, copy.falseLabel],
        correctIndex: effectiveIsCorrect ? 0 : 1,
        tfPairing: {
          front: current.questionSide || current.label,
          back: displayAnswer,
          isCorrect: effectiveIsCorrect,
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

    // Only reachable when MC is enabled (isTF is forced when MC is off).
    const ownAnswer = (current.answerSide || current.label).toLowerCase();
    const wrongAnswers = unique(
      shuffle(
        enriched
          .filter(
            (entry) =>
              entry.card.id !== current.card.id &&
              entry.fillIn === current.fillIn
          )
          .map((entry) => entry.answerSide || entry.label),
        randomFn
      )
    )
      .filter((a) => a.toLowerCase() !== ownAnswer)
      .slice(0, 3);

    // Without at least one same-kind distractor a choice question is
    // meaningless — skip the card rather than mixing sides/languages.
    if (wrongAnswers.length === 0) continue;

    const correctAnswer = current.answerSide || current.label;
    const options = shuffle([correctAnswer, ...wrongAnswers], randomFn);
    const multipleChoiceQuestion: QuizQuestion = {
      type: "mc",
      cardId: current.card.id,
      questionText: current.questionSide || copy.imagePrompt,
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
