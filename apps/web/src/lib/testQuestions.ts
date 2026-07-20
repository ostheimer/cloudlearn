// Fragen-Modell für den klausurartigen Test-Modus (Port von
// apps/mobile/src/lib/testQuestions.ts, ohne Medien-/Bildfragen). Getrennt von
// quizQuestions, damit der Multiple-Choice-Modus unberührt bleibt.

export type TestQuestionType = "mc" | "trueFalse" | "written";

export interface TestCardInput {
  id: string;
  front: string;
  back: string;
  // Kartenart wie in der Datenbank (card_type): "basic", "cloze", "mcq",
  // "matching", "occlusion", … Optional, damit ältere Aufrufer weiter
  // kompilieren; eine Karte ohne Art zählt als "basic".
  type?: string;
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

// Optionen dürfen nur aus Karten DERSELBEN ART kommen: die Kartenart selbst plus
// „Lücke ja/nein". Antworten verschiedener Arten sind nicht vergleichbar — eine
// Occlusion-Rückseite („Bereich 7") ist so wenig eine Antwort auf eine
// Vokabelfrage wie „une forte diminution" eine Antwort auf „Was ist an der
// markierten Stelle?". Gemischt ergeben sie Ablenker, die man ohne jedes
// Fachwissen ausschließen kann — der Test misst dann nichts mehr (#380). Weil
// der Schlüssel die Art selbst ist (statt eine Art beim Namen zu nennen), gilt
// das auch für Kartenarten, die es heute noch nicht gibt.
function kindOf(type: string | undefined, fillIn: boolean): string {
  const base = (type || "").trim().toLowerCase() || "basic";
  return `${base}|${fillIn ? "fill" : "plain"}`;
}

interface EnrichedCard {
  id: string;
  front: string;
  back: string;
  fillIn: boolean;
  kind: string;
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
    const fillIn = isFillIn(front);
    enriched.push({ id: card.id, front, back, fillIn, kind: kindOf(card.type, fillIn) });
  }
  if (enriched.length === 0) return [];

  const answerOf = (e: EnrichedCard) => (reverse ? e.front : e.back);
  const questionOf = (e: EnrichedCard) => (reverse ? e.back : e.front);

  // Ein Antwort-Topf JE KARTENART statt eines gemeinsamen. Eine Karte sieht nur
  // Antworten ihrer eigenen Art — so kann kein Topf in eine fremde Frage laufen.
  const answersByKind = new Map<string, string[]>();
  for (const e of enriched) {
    if (e.fillIn) continue;
    const collected = answersByKind.get(e.kind);
    if (collected) collected.push(answerOf(e));
    else answersByKind.set(e.kind, [answerOf(e)]);
  }
  for (const [kind, answers] of answersByKind) {
    answersByKind.set(kind, unique(answers));
  }

  // Zu wenige gleichartige Antworten → keine Auswahlfrage für diese Art. Die
  // Karte fällt auf eine Schreibfrage zurück, statt fremde Antworten zu borgen.
  const canChoose = (kind: string): boolean =>
    (answersByKind.get(kind)?.length ?? 0) >= 2 && choiceTypes.length > 0;

  const usage = new Map<string, number>();
  const pickDistractors = (kind: string, correct: string, n: number): string[] => {
    const pool = (answersByKind.get(kind) ?? []).filter(
      (b) => b.toLowerCase() !== correct.toLowerCase()
    );
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
    if (canChoose(current.kind)) possible.push(...choiceTypes);
    if (possible.length === 0) continue;

    const type = possible[Math.floor(randomFn() * possible.length)]!;

    if (type === "mc") {
      const distractors = pickDistractors(current.kind, aText, 3);
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
        const wrong = pickDistractors(current.kind, aText, 1);
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
