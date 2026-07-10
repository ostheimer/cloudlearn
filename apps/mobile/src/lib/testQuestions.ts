import { summarizeCardMedia } from "./cardMedia";
import { cleanTerm } from "./cardTerms";

// Question model for the exam-style Test mode. Kept separate from quizQuestions
// so the standalone Multiple-Choice screen is untouched.
export type TestQuestionType = "mc" | "trueFalse" | "written";

export interface TestCardInput {
  id: string;
  front: string;
  back: string;
}

export interface TestQuestion {
  type: TestQuestionType;
  cardId: string;
  prompt: string; // the question (front)
  expected: string; // the correct answer (back) — for "written", what to type
  options: string[]; // "mc" only
  correctIndex: number; // "mc" only, else -1
  tfShownBack: string; // "trueFalse" only — the answer shown (may be wrong)
  tfIsCorrect: boolean; // "trueFalse" only — whether the shown pairing is right
}

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
    const key = item.trim().toLowerCase();
    if (!item.trim() || seen.has(key)) continue;
    seen.add(key);
    result.push(item.trim());
  }
  return result;
}

interface EnrichedCard {
  id: string;
  front: string;
  back: string;
}

function termsOf(card: TestCardInput): EnrichedCard {
  const media = summarizeCardMedia(card);
  const front = cleanTerm((media.plainFront || card.front || "").trim());
  const back = cleanTerm((media.plainBack || card.back || "").trim());
  return { id: card.id, front, back };
}

export interface BuildTestOptions {
  count: number;
  types: TestQuestionType[];
  randomFn?: () => number;
}

export function buildTestQuestions(
  cards: TestCardInput[],
  options: BuildTestOptions
): TestQuestion[] {
  const randomFn = options.randomFn ?? Math.random;
  const types = options.types.length > 0 ? options.types : ["written"];

  const enriched = cards
    .map(termsOf)
    .filter((c) => c.front.length > 0 && c.back.length > 0);
  if (enriched.length === 0) return [];

  const canPickOthers = enriched.length >= 2;
  const shuffled = shuffle(enriched, randomFn);
  const limit = Math.min(options.count, shuffled.length);
  const questions: TestQuestion[] = [];

  for (let i = 0; i < limit; i++) {
    const current = shuffled[i]!;

    // Choose a type from the enabled ones. MC and True/False need at least one
    // other card for a distractor; fall back to "written" if not possible.
    let type = types[Math.floor(randomFn() * types.length)]!;
    if ((type === "mc" || type === "trueFalse") && !canPickOthers) {
      type = "written";
    }

    const otherBacks = unique(
      enriched.filter((c) => c.id !== current.id).map((c) => c.back)
    ).filter((b) => b.toLowerCase() !== current.back.toLowerCase());

    if (type === "mc" && otherBacks.length >= 1) {
      const distractors = shuffle(otherBacks, randomFn).slice(0, 3);
      const opts = shuffle([current.back, ...distractors], randomFn);
      questions.push({
        type: "mc",
        cardId: current.id,
        prompt: current.front,
        expected: current.back,
        options: opts,
        correctIndex: opts.indexOf(current.back),
        tfShownBack: "",
        tfIsCorrect: false,
      });
    } else if (type === "trueFalse" && canPickOthers) {
      const showWrong = randomFn() < 0.5 && otherBacks.length >= 1;
      const shownBack = showWrong
        ? otherBacks[Math.floor(randomFn() * otherBacks.length)]!
        : current.back;
      questions.push({
        type: "trueFalse",
        cardId: current.id,
        prompt: current.front,
        expected: current.back,
        options: [],
        correctIndex: -1,
        tfShownBack: shownBack,
        tfIsCorrect: shownBack.toLowerCase() === current.back.toLowerCase(),
      });
    } else {
      questions.push({
        type: "written",
        cardId: current.id,
        prompt: current.front,
        expected: current.back,
        options: [],
        correctIndex: -1,
        tfShownBack: "",
        tfIsCorrect: false,
      });
    }
  }

  return questions;
}
