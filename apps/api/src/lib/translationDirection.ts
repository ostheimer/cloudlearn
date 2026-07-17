// A vocabulary deck must face one way. The model decides front/back per card,
// so a source sheet that lists some rows German-first yields a deck where "back"
// is French on some cards and German on others — the quiz then draws its
// distractors from that mixed column and offers French and German answers side
// by side (deck "Französisch: Diagrammanalyse Vokabeln": 16 fr→de, 4 de→fr).
//
// The prompt asks for one direction, but that is a per-card request the model
// forgets across 25 cards. So the model only labels each side's language — a
// per-card judgement it is reliable at — and this module enforces the deck-wide
// invariant, which needs a view of all cards at once: per language pair the
// majority direction wins and the outliers get flipped.

export interface DirectionalCard {
  front: string;
  back: string;
  type?: string;
  frontLang?: string;
  backLang?: string;
}

// Only two-letter ISO 639-1 codes are trusted. "fr-FR" narrows to "fr"; anything
// else the model might emit ("French", "unknown", "") is treated as unlabelled,
// which leaves the card untouched — never flipped on a guess.
function normalizeLang(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const code = value.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  return /^[a-z]{2}$/.test(code) ? code : undefined;
}

const MARKDOWN_IMAGE_REGEX = /!\[[^\]]*\]\(https?:\/\/[^\s)]+\)/i;
const GAP_REGEX = /_{2,}|\{\{c\d+::/;

// A card is only a flippable translation pair when both sides are labelled with
// different languages AND the sides are interchangeable. Cloze/gap cards are not:
// their front carries the gap sentence and their back the missing word, so
// flipping would destroy them. Image cards would move the image to the back.
function directionOf(card: DirectionalCard): { from: string; to: string } | undefined {
  if (card.type && card.type !== "basic") return undefined;
  const from = normalizeLang(card.frontLang);
  const to = normalizeLang(card.backLang);
  if (!from || !to || from === to) return undefined;
  const text = `${card.front}\n${card.back}`;
  if (GAP_REGEX.test(text) || MARKDOWN_IMAGE_REGEX.test(text)) return undefined;
  return { from, to };
}

function pairKey(from: string, to: string): string {
  return [from, to].sort().join("|");
}

/**
 * Flip translation cards that face against their deck's majority direction.
 *
 * Cards are grouped by language pair (de|fr), so a deck mixing several pairs is
 * handled per pair. Within a group the more frequent direction wins; on a tie
 * nothing is flipped, since there is no majority to trust. Non-translation cards
 * pass through untouched.
 */
export function normalizeTranslationDirection<T extends DirectionalCard>(cards: T[]): T[] {
  const counts = new Map<string, Map<string, number>>();
  for (const card of cards) {
    const direction = directionOf(card);
    if (!direction) continue;
    const key = pairKey(direction.from, direction.to);
    const byDirection = counts.get(key) ?? new Map<string, number>();
    const directionKey = `${direction.from}>${direction.to}`;
    byDirection.set(directionKey, (byDirection.get(directionKey) ?? 0) + 1);
    counts.set(key, byDirection);
  }

  const winner = new Map<string, string>();
  for (const [key, byDirection] of counts) {
    const ranked = [...byDirection.entries()].sort((a, b) => b[1] - a[1]);
    const [best, runnerUp] = ranked;
    if (!best) continue;
    if (runnerUp && runnerUp[1] === best[1]) continue; // tie — leave the deck as-is
    winner.set(key, best[0]);
  }

  return cards.map((card) => {
    const direction = directionOf(card);
    if (!direction) return card;
    const target = winner.get(pairKey(direction.from, direction.to));
    if (!target || target === `${direction.from}>${direction.to}`) return card;
    return {
      ...card,
      front: card.back,
      back: card.front,
      frontLang: card.backLang,
      backLang: card.frontLang,
    };
  });
}
