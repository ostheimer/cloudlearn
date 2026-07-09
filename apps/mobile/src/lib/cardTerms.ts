// Pulls the bare term out of a translation-question wrapper, so scanned vocab
// cards behave as clean pairs (le record <-> der Rekord) in every study mode.
//
// It only fires for genuine *translation* questions — the text must contain a
// quoted term AND a translation signal ("übersetze", or a target language such
// as "auf Deutsch" / "auf Französisch" / "ins Deutsche"). Real subject or
// definition questions ("Was ist ein Intervall?", "Was bedeutet 'Legato'?"
// without a target language) are returned unchanged.

const TRANSLATION_SIGNAL =
  /übersetz|\bauf\s+(?:deutsch|latein|[a-zäöü]+isch)\b|\bins\s+(?:deutsche|[a-zäöü]+ische)\b/i;

// Straight, German, curly and guillemet quotation marks.
const QUOTES = "'\"„“”‘’«»";
const QUOTED_TERM = new RegExp("[" + QUOTES + "]([^" + QUOTES + "]{1,60})[" + QUOTES + "]");

export function cleanTerm(text: string): string {
  if (!text || !TRANSLATION_SIGNAL.test(text)) return text;
  const match = text.match(QUOTED_TERM);
  const term = match?.[1]?.trim();
  return term && term.length > 0 ? term : text;
}
