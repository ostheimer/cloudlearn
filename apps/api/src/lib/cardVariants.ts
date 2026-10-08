interface VariantCard {
  front: string;
  back: string;
  type?: string;
  frontLang?: string;
  backLang?: string;
}

function text(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Recognise naming frames, not arbitrary semantic similarity. Keep word order,
 * qualifiers, negation, and language: sharing an answer alone proves nothing.
 */
function namingSubject(card: VariantCard): string | null {
  let front = card.front.toLowerCase()
    // Optional examples do not change what the naming question asks about.
    .replace(/\(\s*(?:z\.\s*b\.|e\.g\.)[^)]*\)/gi, " ");
  if (card.type === "basic") {
    if (!/^wie (?:nennt|bezeichnet) man\b/i.test(front)) return null;
    front = front.replace(/^wie (?:nennt|bezeichnet) man\s+/i, "");
  } else if (card.type === "cloze") {
    if (!/_{3,}/.test(front)) return null;
    // Only gaps in a naming frame qualify. A blank in a different part of a
    // sentence can examine another fact even if the answer happens to match.
    const frame = /\s+(?:nennt man\s+_{3,}|wird (?:als\s+)?_{3,}\s+(?:bezeichnet|genannt))\s*[.!?]?\s*$/i;
    if (!frame.test(front)) return null;
    front = front.replace(frame, "");
  } else return null;
  const subject = text(front);
  return subject.split(" ").length >= 6 ? subject : null;
}

function sameNamingFact(basic: VariantCard, cloze: VariantCard): boolean {
  if (basic.frontLang !== cloze.frontLang || basic.backLang !== cloze.backLang) return false;
  if (!basic.back?.trim() || text(basic.back) !== text(cloze.back)) return false;
  const basicSubject = namingSubject(basic);
  const clozeSubject = namingSubject(cloze);
  if (!basicSubject || !clozeSubject) return false;
  if (basicSubject === clozeSubject) return true;
  // The observed photo pair differs only by the question's final alternative:
  // "zum Schlafen oder Rasten" versus "zum Schlafen". Retain the fuller basic
  // question. Do not permit arbitrary omitted modifiers or reordered words.
  const alternative = basicSubject.slice(clozeSubject.length);
  return basicSubject.startsWith(`${clozeSubject} oder `)
    && alternative.trim().split(" ").length <= 4;
}

/** Keep the fuller question when a model repeats a naming fact as a cloze card.
 * This deliberately misses paraphrases it cannot prove equivalent; the prompt
 * is responsible for avoiding variants in general. Standalone cloze cards and
 * distinct questions with identical answers remain untouched.
 */
export function dropRedundantNamingVariants<T extends VariantCard>(cards: T[]): T[] {
  const basicCards = cards.filter((card) => card.type === "basic");
  return cards.filter((card) => card.type !== "cloze"
    || !basicCards.some((basic) => sameNamingFact(basic, card)));
}
