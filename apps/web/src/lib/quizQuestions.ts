// Fragen-Erzeugung für den Multiple-Choice-Modus (Port von
// apps/mobile/src/lib/quizQuestions.ts, ohne Bild-/Medienfragen). Erzeugt
// Multiple-Choice- und Wahr/Falsch-Fragen aus den Karten eines Decks, gesteuert
// über die im Setup gewählten Optionen (Richtung + Fragetypen).
//
// Kartentexte werden wie in der App vorab aufbereitet (#569): Bild-Markdown
// raus, Übersetzungs-Zusätze raus, und der Lückensatz zeigt den Strich statt
// {{cN::…}} — sonst stünde die Lösung sichtbar in der Frage.

import { cleanTerm, formatCloze, summarizeCardMedia } from "./card-display";

export interface QuizCardInput {
  id: string;
  front: string;
  back: string;
  // Kartenart wie in der Datenbank (card_type): "basic", "cloze", "mcq",
  // "matching", "occlusion", … Optional, damit ältere Aufrufer weiter
  // kompilieren; eine Karte ohne Art zählt als "basic".
  type?: string;
}

export type QuizType = "mc" | "trueFalse";

export interface QuizQuestion {
  type: QuizType;
  cardId: string;
  questionText: string; // mc: die Frageseite; tf: die Aufforderung
  options: string[];
  correctIndex: number;
  correctAnswer: string;
  // correctBack: die wirklich zur Karte gehörende Antwortseite — der
  // Ergebnis-Bildschirm zeigt sie, wenn die gezeigte Paarung falsch war (#497).
  tfPairing?: { front: string; back: string; correctBack: string; isCorrect: boolean };
}

export interface GenerateOptions {
  // back -> front für normale Karten (Lücken-Karten behalten ihren Lückensatz).
  reverse?: boolean;
  // Vom Lernenden aktivierte Fragetypen — mindestens einer sollte true sein.
  allowMc?: boolean;
  allowTrueFalse?: boolean;
  // Obergrenze der Rundenlänge (#570). Ohne Angabe: keine Grenze (alle Karten).
  // Begrenzt die FRAGEN, nicht die betrachteten Karten: Wird eine Karte
  // übersprungen (kein gleichartiger Ablenker), rückt eine spätere nach.
  count?: number;
}

const TF_PROMPT = "Stimmt diese Zuordnung?";
const TRUE_LABEL = "Richtig";
const FALSE_LABEL = "Falsch";

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

// Eine Lücken-Karte ist ein Satz mit Lücke ("______" oder {{cN::…}}). Ihre
// Antwort ist das fehlende Wort — meist in der Frontsprache des Decks — und darf
// daher nie als Option für eine normale Karte auftauchen (und umgekehrt).
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

export function generateQuestions(
  cards: QuizCardInput[],
  opts: GenerateOptions = {},
  randomFn: () => number = Math.random
): QuizQuestion[] {
  const reverse = opts.reverse ?? false;
  const allowMc = opts.allowMc ?? true;
  const allowTrueFalse = opts.allowTrueFalse ?? true;
  const count = opts.count ?? Infinity;
  if (cards.length < 2 || (!allowMc && !allowTrueFalse)) return [];

  const seenPairs = new Set<string>();
  const enriched = cards.flatMap((card) => {
    // Aufbereitung wie die App: Bild-Markdown raus, Übersetzungs-Zusätze raus.
    // Reine Bild-Karten haben danach keinen Text mehr und fallen weg — ohne
    // Bildanzeige (Dateikopf) wäre ihre Frage nicht beantwortbar.
    const media = summarizeCardMedia({ front: card.front || "", back: card.back || "" });
    const front = cleanTerm(media.plainFront);
    const back = cleanTerm(media.plainBack);
    if (!front || !back) return [];
    // Decks enthalten Karten manchmal doppelt (Doppel-Scans) — Duplikate raus.
    // Der Schlüssel nutzt den Satz MIT {{cN::…}}: zwei Lückensätze, die sich
    // nur in der Lösung unterscheiden, sind keine Duplikate.
    const key = `${front}|${back}`.toLowerCase();
    if (seenPairs.has(key)) return [];
    seenPairs.add(key);
    const fillIn = isFillIn(front);
    // Frage-/Antwortseite folgt der Richtung; Lücken-Karten zeigen immer ihren
    // Lückensatz (mit Strich statt Lücken-Code) und erwarten das fehlende Wort.
    const questionSide = fillIn ? formatCloze(front).display : reverse ? back : front;
    const answerSide = fillIn || !reverse ? back : front;
    return [
      {
        card,
        fillIn,
        kind: kindOf(card.type, fillIn),
        questionSide,
        answerSide,
        label: back || front,
      },
    ];
  });

  const questions: QuizQuestion[] = [];
  for (const current of shuffle(enriched, randomFn)) {
    if (questions.length >= count) break;
    const sameKind = enriched.filter(
      (e) => e.card.id !== current.card.id && e.kind === current.kind
    );
    const isTF =
      allowTrueFalse && (!allowMc || (randomFn() < 0.3 && cards.length >= 3));

    if (isTF) {
      const isCorrect = randomFn() < 0.5;
      const ownAnswer = (current.answerSide || current.label).toLowerCase();
      const wrongPool = unique(sameKind.map((e) => e.answerSide || e.label)).filter(
        (a) => a.toLowerCase() !== ownAnswer
      );
      const wrongAnswer = wrongPool[Math.floor(randomFn() * wrongPool.length)];
      // Ohne gleichartige Falsch-Antwort ist die gezeigte Paarung zwangsläufig
      // korrekt — dann als "Richtig" werten statt "Falsch" zu verlangen.
      const effectiveIsCorrect = isCorrect || !wrongAnswer;
      const shownAnswer =
        !effectiveIsCorrect && wrongAnswer ? wrongAnswer : current.answerSide || current.label;
      questions.push({
        type: "trueFalse",
        cardId: current.card.id,
        questionText: TF_PROMPT,
        options: [TRUE_LABEL, FALSE_LABEL],
        correctIndex: effectiveIsCorrect ? 0 : 1,
        correctAnswer: effectiveIsCorrect ? TRUE_LABEL : FALSE_LABEL,
        tfPairing: {
          front: current.questionSide || current.label,
          back: shownAnswer,
          correctBack: current.answerSide || current.label,
          isCorrect: effectiveIsCorrect,
        },
      });
      continue;
    }

    // Nur erreichbar, wenn MC aktiv ist (isTF ist erzwungen, wenn MC aus ist).
    const ownAnswer = (current.answerSide || current.label).toLowerCase();
    const wrongAnswers = unique(
      shuffle(sameKind.map((e) => e.answerSide || e.label), randomFn)
    )
      .filter((a) => a.toLowerCase() !== ownAnswer)
      .slice(0, 3);
    // Ohne mindestens einen gleichartigen Ablenker ist eine Auswahlfrage
    // sinnlos — Karte überspringen statt Seiten/Sprachen zu mischen.
    if (wrongAnswers.length === 0) continue;

    const correctAnswer = current.answerSide || current.label;
    const options = shuffle([correctAnswer, ...wrongAnswers], randomFn);
    questions.push({
      type: "mc",
      cardId: current.card.id,
      questionText: current.questionSide,
      options,
      correctIndex: options.indexOf(correctAnswer),
      correctAnswer,
    });
  }
  return questions;
}
