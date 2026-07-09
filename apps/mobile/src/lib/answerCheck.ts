// Forgiving free-text answer comparison, shared by the Lückentext mode and the
// Test (Klausur) mode. "Forgiving" means we ignore things a learner shouldn't
// be marked wrong for:
//   - upper/lower case ("Waerme" case)
//   - accents / diacritics ("cafe" vs "café", umlauts)
//   - surrounding whitespace and common punctuation
//   - a single-character typo (one insertion/deletion/substitution)
// Expected answers may list alternatives separated by "/" or ";" — typing any
// one of them counts as correct.

const DIACRITICS = /[̀-ͯ]/g;

export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICS, "") // strip combining accents so é -> e, ä -> a
    .toLowerCase()
    .replace(/[.,;:!?]/g, "") // drop sentence punctuation
    .replace(/\s+/g, " ")
    .trim();
}

// Standard Levenshtein edit distance between two strings.
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j]! + 1, // deletion
        curr[j - 1]! + 1, // insertion
        prev[j - 1]! + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
}

export function isAnswerCorrect(input: string, expected: string): boolean {
  const answer = normalizeAnswer(input);
  if (!answer) return false;

  // Split alternatives first (before punctuation is stripped), then normalize.
  const candidates = [expected, ...expected.split(/[/;]/)]
    .map(normalizeAnswer)
    .filter((c) => c.length > 0);

  return candidates.some(
    (candidate) =>
      candidate === answer ||
      // Tolerate a single typo, but only for words long enough that one edit
      // doesn't collapse two genuinely different short answers into a match.
      (candidate.length >= 4 && levenshtein(answer, candidate) <= 1)
  );
}
