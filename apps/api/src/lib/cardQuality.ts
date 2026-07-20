// A cloze card whose front already contains its answer teaches nothing — the
// learner fills the gap by copying a word two lines up. The prompt forbids this
// ("NEVER put the answer in the front text for cloze cards!"), but a prompt is a
// request: measured over 351 generated cards, 1 of 70 cloze cards still leaked
// ("Wenn eine KI mit fehlerhaften Daten gefüttert wird, liefert sie ______
// Ergebnisse." -> "fehlerhafte"). The model considers itself compliant because
// "fehlerhaften" and "fehlerhafte" differ as strings.
//
// So the prompt asks and this module enforces, the same split that keeps
// translation direction honest in translationDirection.ts.

export interface QualityCard {
  front: string;
  back: string;
  type?: string;
}

// Words this short match inside unrelated words too often, and a 3-letter gap is
// rarely the point of a card anyway.
const MIN_ANSWER_LENGTH = 4;

// How many trailing letters a question word may add and still count as the same
// word. German inflection is short ("fehlerhafte" -> "fehlerhaften", +1;
// "Agent" -> "Agenten", +2). Compounds add a whole morpheme and must NOT match:
// "Prozent" -> "Prozentsatz" is +4, and a card asking "Der Prozentsatz steigt
// auf ______." with answer "80 Prozent" is perfectly sound.
const MAX_INFLECTION_SUFFIX = 2;

function words(value: string): string[] {
  return (value ?? "")
    .toLowerCase()
    .split(/[^a-zäöüß0-9]+/)
    .filter(Boolean);
}

// Same word up to German inflection: exact, or the text adds at most a short
// suffix to the answer's word.
function sameWord(textWord: string, answerWord: string): boolean {
  if (textWord === answerWord) return true;
  return (
    textWord.startsWith(answerWord) && textWord.length - answerWord.length <= MAX_INFLECTION_SUFFIX
  );
}

/**
 * True when a cloze card's question already gives away its own answer.
 *
 * Compares word sequences rather than raw substrings, so a multi-word answer
 * only counts when its words appear together and in order. Only cloze cards are
 * judged: a basic card legitimately repeats its question in the answer
 * ("Was ist X?" -> "X ist ..."), and the same rule there would delete good cards.
 */
export function revealsOwnAnswer(card: QualityCard): boolean {
  if (card.type !== "cloze") return false;

  const answerWords = words(card.back);
  if (answerWords.length === 0) return false;
  if (answerWords.join("").length < MIN_ANSWER_LENGTH) return false;

  const frontWords = words(card.front);
  if (frontWords.length < answerWords.length) return false;

  for (let start = 0; start <= frontWords.length - answerWords.length; start++) {
    const matches = answerWords.every((answerWord, offset) =>
      sameWord(frontWords[start + offset]!, answerWord)
    );
    if (matches) return true;
  }
  return false;
}

/**
 * Drop cards that give away their own answer.
 *
 * Dropping beats repairing: rewriting the question would mean guessing what the
 * card meant to ask. One weak card lost is cheaper than one wrong card learned,
 * and the generator produces far more cards than a deck needs.
 */
export function dropSelfRevealingCards<T extends QualityCard>(cards: T[]): T[] {
  return cards.filter((card) => !revealsOwnAnswer(card));
}
