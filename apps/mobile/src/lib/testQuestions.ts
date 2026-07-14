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
  prompt: string; // the question
  expected: string; // the correct answer — for "written", what to type
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
  fillIn: boolean;
}

// A fill-in card is a sentence with a gap ("______" or a {{cN::…}} cloze). Its
// answer is the missing word, so it is always a "type the gap" question and
// never contributes options — regardless of direction.
function isFillIn(text: string): boolean {
  return /_{2,}/.test(text) || /\{\{c\d+::/.test(text);
}

function termsOf(card: TestCardInput): EnrichedCard {
  const media = summarizeCardMedia(card);
  const rawFront = (media.plainFront || card.front || "").trim();
  const front = cleanTerm(rawFront);
  const back = cleanTerm((media.plainBack || card.back || "").trim());
  return { id: card.id, front, back, fillIn: isFillIn(rawFront) };
}

function writtenQuestion(
  cardId: string,
  prompt: string,
  expected: string
): TestQuestion {
  return {
    type: "written",
    cardId,
    prompt,
    expected,
    options: [],
    correctIndex: -1,
    tfShownBack: "",
    tfIsCorrect: false,
  };
}

export interface BuildTestOptions {
  count: number;
  types: TestQuestionType[];
  // When true, non-fill-in cards are asked back → front (options come from the
  // fronts). Fill-in cards stay "fill the gap" either way.
  reverse?: boolean;
  randomFn?: () => number;
}

export function buildTestQuestions(
  cards: TestCardInput[],
  options: BuildTestOptions
): TestQuestion[] {
  const randomFn = options.randomFn ?? Math.random;
  const reverse = options.reverse ?? false;
  const enabled: TestQuestionType[] =
    options.types.length > 0 ? options.types : ["written"];
  const writtenEnabled = enabled.includes("written");
  const choiceTypes = enabled.filter((t) => t === "mc" || t === "trueFalse");

  // Enrich, drop empties, and de-duplicate (decks sometimes hold each card twice).
  const seen = new Set<string>();
  const enriched: EnrichedCard[] = [];
  for (const card of cards) {
    const e = termsOf(card);
    if (!e.front || !e.back) continue;
    const key = `${e.front}|${e.back}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    enriched.push(e);
  }
  if (enriched.length === 0) return [];

  // The answer side (and therefore the option pool) follows the direction:
  // forward → back, reverse → front. Options only ever come from the same side
  // as the correct answer, and never from fill-in cards.
  const answerOf = (e: EnrichedCard) => (reverse ? e.front : e.back);
  const questionOf = (e: EnrichedCard) => (reverse ? e.back : e.front);

  const choiceAnswers = unique(
    enriched.filter((e) => !e.fillIn).map(answerOf)
  );
  const canChoose = choiceAnswers.length >= 2 && choiceTypes.length > 0;

  const usage = new Map<string, number>();
  const pickDistractors = (correct: string, n: number): string[] => {
    const pool = choiceAnswers.filter(
      (b) => b.toLowerCase() !== correct.toLowerCase()
    );
    const ordered = shuffle(pool, randomFn).sort(
      (a, b) =>
        (usage.get(a.toLowerCase()) ?? 0) - (usage.get(b.toLowerCase()) ?? 0)
    );
    const picked = ordered.slice(0, n);
    for (const p of picked) {
      usage.set(p.toLowerCase(), (usage.get(p.toLowerCase()) ?? 0) + 1);
    }
    return picked;
  };

  const shuffled = shuffle(enriched, randomFn);
  const questions: TestQuestion[] = [];

  for (let i = 0; i < shuffled.length && questions.length < options.count; i++) {
    const current = shuffled[i]!;

    // Fill-in cards are always "fill the gap" (front sentence → missing word).
    if (current.fillIn) {
      if (writtenEnabled) {
        questions.push(writtenQuestion(current.id, current.front, current.back));
      }
      continue;
    }

    const qText = questionOf(current);
    const aText = answerOf(current);

    const possible: TestQuestionType[] = [];
    if (writtenEnabled) possible.push("written");
    if (canChoose) possible.push(...choiceTypes);
    if (possible.length === 0) continue;

    const type = possible[Math.floor(randomFn() * possible.length)]!;

    if (type === "mc") {
      const distractors = pickDistractors(aText, 3);
      if (distractors.length === 0) {
        if (writtenEnabled) {
          questions.push(writtenQuestion(current.id, qText, aText));
        }
        continue;
      }
      const opts = shuffle([aText, ...distractors], randomFn);
      questions.push({
        type: "mc",
        cardId: current.id,
        prompt: qText,
        expected: aText,
        options: opts,
        correctIndex: opts.indexOf(aText),
        tfShownBack: "",
        tfIsCorrect: false,
      });
    } else if (type === "trueFalse") {
      const showWrong = randomFn() < 0.5;
      let shown = aText;
      if (showWrong) {
        const wrong = pickDistractors(aText, 1);
        if (wrong.length > 0) shown = wrong[0]!;
      }
      questions.push({
        type: "trueFalse",
        cardId: current.id,
        prompt: qText,
        expected: aText,
        options: [],
        correctIndex: -1,
        tfShownBack: shown,
        tfIsCorrect: shown.toLowerCase() === aText.toLowerCase(),
      });
    } else {
      questions.push(writtenQuestion(current.id, qText, aText));
    }
  }

  return questions;
}
