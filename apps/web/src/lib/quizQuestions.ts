import { cleanTerm, formatCloze, summarizeCardMedia, type MarkdownImage } from "./card-display";

export interface QuizCardInput {
  id: string;
  front: string;
  back: string;
  // Kartenart wie in der Datenbank (card_type): "basic", "cloze", "mcq",
  // "matching", "occlusion", … Optional, damit ältere Aufrufer weiter
  // kompilieren; eine Karte ohne Art zählt als "basic".
  type?: string;
}

export type QuizType = "mc" | "trueFalse" | "imageMc";

export interface QuizQuestion {
  questionImages?: MarkdownImage[];
  optionImages?: MarkdownImage[][];
  pairingImages?: MarkdownImage[];
  correctAnswerImages?: MarkdownImage[];
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
  allowImage?: boolean;
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

/**
 * Der Fragen-Pool hinter generateQuestions: Text oder Bild auf beiden Seiten,
 * identische Scans einmal. Herausgelöst, damit die Anzahl-Auswahl im
 * Setup („Alle (N)", #612) mit EXAKT derselben Regel zählt — vorher prüfte sie
 * nur rohen Text: Karten, deren Seite nach der Aufbereitung leer ist (reines
 * Bild-Markdown), zählten mit, Doppel-Scans zählten doppelt.
 */
function buildQuestionPool(cards: QuizCardInput[], reverse: boolean) {
  const seenPairs = new Set<string>();
  return cards.flatMap((card) => {
    if (card.type === "occlusion") return [];
    const media = summarizeCardMedia({ front: card.front || "", back: card.back || "" });
    const front = cleanTerm(media.plainFront);
    const back = cleanTerm(media.plainBack);
    if ((!front && !media.frontImages.length) || (!back && !media.backImages.length)) return [];
    const key = JSON.stringify([front.toLowerCase(), back.toLowerCase(), media.frontImages.map(i => i.url), media.backImages.map(i => i.url)]);
    if (seenPairs.has(key)) return [];
    seenPairs.add(key);
    const fillIn = isFillIn(front);
    const flipped = reverse && !fillIn;
    const questionSide = fillIn ? formatCloze(front).display : flipped ? back : front;
    const answerSide = flipped ? front : back;
    const questionImages = flipped ? media.backImages : media.frontImages;
    const answerImages = flipped ? media.frontImages : media.backImages;
    return [{ card, fillIn, kind: kindOf(card.type, fillIn), questionSide, answerSide,
      questionImages, answerImages,
      answerKey: answerSide.trim().toLowerCase() || JSON.stringify(answerImages.map(i => i.url)),
    }];
  });
}

/**
 * Wie viele Fragen „Alle (N)" höchstens verspricht (#612) — dieselbe Regel,
 * mit der generateQuestions seinen Pool baut. Bilder zählen als Seite; die Richtung spielt für die Anzahl keine Rolle.
 */
export function countQuizableCards(cards: QuizCardInput[]): number {
  return buildQuestionPool(cards, false).length;
}

export function generateQuestions(
  cards: QuizCardInput[],
  opts: GenerateOptions = {},
  randomFn: () => number = Math.random
): QuizQuestion[] {
  const reverse = opts.reverse ?? false;
  const allowMc = opts.allowMc ?? true;
  const allowTrueFalse = opts.allowTrueFalse ?? true;
  const allowImage = opts.allowImage ?? true;
  const count = opts.count ?? Infinity;
  if (cards.length < 2 || (!allowMc && !allowTrueFalse && !allowImage)) return [];
  const enriched = buildQuestionPool(cards, reverse);
  const questions: QuizQuestion[] = [];
  for (const current of shuffle(enriched, randomFn)) {
    if (questions.length >= count) break;
    const seen = new Set([current.answerKey]);
    const sameKind = enriched.filter(e => {
      if (e.card.id === current.card.id || e.kind !== current.kind || seen.has(e.answerKey)) return false;
      seen.add(e.answerKey);
      return true;
    });
    // The App's imageMc type, using the selected question side. Image-only
    // questions always use it; mixed text/image cards use the same 35% mix.
    const imageQuestion = allowImage && !current.fillIn && current.questionImages.length > 0 &&
      (!current.questionSide || (!allowMc && !allowTrueFalse) || randomFn() < 0.35);
    const isTF = !imageQuestion && allowTrueFalse && (!allowMc || (randomFn() < 0.3 && cards.length >= 3));
    if (isTF) {
      const isCorrect = randomFn() < 0.5;
      const wrong = sameKind[Math.floor(randomFn() * sameKind.length)];
      const effectiveIsCorrect = isCorrect || !wrong;
      const shown = effectiveIsCorrect ? current : wrong!;
      questions.push({
        type: "trueFalse", cardId: current.card.id, questionText: TF_PROMPT,
        options: [TRUE_LABEL, FALSE_LABEL], correctIndex: effectiveIsCorrect ? 0 : 1,
        correctAnswer: effectiveIsCorrect ? TRUE_LABEL : FALSE_LABEL,
        questionImages: current.questionImages, pairingImages: shown.answerImages,
        correctAnswerImages: current.answerImages,
        tfPairing: { front: current.questionSide, back: shown.answerSide,
          correctBack: current.answerSide, isCorrect: effectiveIsCorrect },
      });
      continue;
    }
    if (!imageQuestion && !allowMc) continue;
    const wrongAnswers = shuffle(sameKind, randomFn).slice(0, 3);
    if (!wrongAnswers.length) continue;
    const entries = shuffle([current, ...wrongAnswers], randomFn);
    questions.push({
      type: imageQuestion ? "imageMc" : "mc", cardId: current.card.id,
      questionText: imageQuestion ? "Welches Element zeigt das Bild?" : current.questionSide,
      questionImages: current.questionImages,
      options: entries.map(e => e.answerSide), optionImages: entries.map(e => e.answerImages),
      correctIndex: entries.indexOf(current), correctAnswer: current.answerSide,
      correctAnswerImages: current.answerImages,
    });
  }
  return questions;
}
