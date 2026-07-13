// Fragen-Modell für den klausurartigen Test-Modus (Port von
// apps/mobile/src/lib/testQuestions.ts, ohne Medien-/Bildfragen). Getrennt von
// quizQuestions, damit der Multiple-Choice-Modus unberührt bleibt.

export type TestQuestionType = "mc" | "trueFalse" | "written";

export interface TestCardInput {
  id: string;
  front: string;
  back: string;
}

export interface TestQuestion {
  type: TestQuestionType;
  cardId: string;
  prompt: string; // die Frage
  expected: string; // die richtige Antwort — bei "written" das, was zu tippen ist
  options: string[]; // nur "mc"
  correctIndex: number; // nur "mc", sonst -1
  tfShownBack: string; // nur "trueFalse" — die gezeigte (evtl. falsche) Antwort
  tfIsCorrect: boolean; // nur "trueFalse" — ob die gezeigte Paarung stimmt
}

export interface BuildTestOptions {
  count: number;
  types: TestQuestionType[];
  // Bei true werden Nicht-Lücken-Karten back → front abgefragt (Optionen aus den
  // Vorderseiten). Lücken-Karten bleiben in jeder Richtung "Lücke füllen".
  reverse?: boolean;
  randomFn?: () => number;
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

// Eine Lücken-Karte ist ein Satz mit Lücke ("______" oder {{cN::…}}). Ihre
// Antwort ist das fehlende Wort — daher immer eine "tippe die Lücke"-Frage und
// nie eine Options-Quelle, unabhängig von der Richtung.
function isFillIn(text: string): boolean {
  return /_{2,}/.test(text) || /\{\{c\d+::/.test(text);
}

interface EnrichedCard {
  id: string;
  front: string;
  back: string;
  fillIn: boolean;
}

function writtenQuestion(cardId: string, prompt: string, expected: string): TestQuestion {
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

export function buildTestQuestions(
  cards: TestCardInput[],
  options: BuildTestOptions
): TestQuestion[] {
  const randomFn = options.randomFn ?? Math.random;
  const reverse = options.reverse ?? false;
  const enabled: TestQuestionType[] = options.types.length > 0 ? options.types : ["written"];
  const writtenEnabled = enabled.includes("written");
  const choiceTypes = enabled.filter((t) => t === "mc" || t === "trueFalse");

  // Anreichern, Leere raus, Duplikate raus (Decks halten Karten manchmal doppelt).
  const seen = new Set<string>();
  const enriched: EnrichedCard[] = [];
  for (const card of cards) {
    const front = (card.front || "").trim();
    const back = (card.back || "").trim();
    if (!front || !back) continue;
    const key = `${front}|${back}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    enriched.push({ id: card.id, front, back, fillIn: isFillIn(front) });
  }
  if (enriched.length === 0) return [];

  const answerOf = (e: EnrichedCard) => (reverse ? e.front : e.back);
  const questionOf = (e: EnrichedCard) => (reverse ? e.back : e.front);

  const choiceAnswers = unique(enriched.filter((e) => !e.fillIn).map(answerOf));
  const canChoose = choiceAnswers.length >= 2 && choiceTypes.length > 0;

  const usage = new Map<string, number>();
  const pickDistractors = (correct: string, n: number): string[] => {
    const pool = choiceAnswers.filter((b) => b.toLowerCase() !== correct.toLowerCase());
    const ordered = shuffle(pool, randomFn).sort(
      (a, b) => (usage.get(a.toLowerCase()) ?? 0) - (usage.get(b.toLowerCase()) ?? 0)
    );
    const picked = ordered.slice(0, n);
    for (const p of picked) usage.set(p.toLowerCase(), (usage.get(p.toLowerCase()) ?? 0) + 1);
    return picked;
  };

  const shuffled = shuffle(enriched, randomFn);
  const limit = Math.min(options.count, shuffled.length);
  const questions: TestQuestion[] = [];

  for (let i = 0; i < limit; i++) {
    const current = shuffled[i]!;

    // Lücken-Karten sind immer "Lücke füllen" (Front-Satz → fehlendes Wort).
    if (current.fillIn) {
      if (writtenEnabled) questions.push(writtenQuestion(current.id, current.front, current.back));
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
        if (writtenEnabled) questions.push(writtenQuestion(current.id, qText, aText));
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
