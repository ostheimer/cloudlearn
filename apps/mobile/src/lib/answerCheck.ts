// Forgiving free-text answer comparison, shared by the Lückentext mode and the
// Test (Klausur) mode. "Forgiving" means we ignore things a learner shouldn't
// be marked wrong for:
//   - upper/lower case ("Waerme" case)
//   - accents / diacritics ("cafe" vs "café", umlauts)
//   - surrounding whitespace and common punctuation
//   - small typos (edit distance scaled to the answer's length)
// Expected answers may list alternatives separated by "/", ";" or "," — typing
// any one of them counts. Pass { strict: true } for exact matching (case,
// accents and spelling all count), which still accepts any one alternative.

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

// Answers may list several accepted variants separated by "/", ";" or "," —
// e.g. "beispiellos, ohnegleichen". Typing any one of them counts.
function splitAlternatives(expected: string): string[] {
  return [expected, ...expected.split(/[/;,]/)]
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > 0);
}

// True when the answer fails ONLY on upper/lower case. The Lückentext then
// shows the yellow "Fast" state instead of red (#610, Lara's decision): the
// keyboard deliberately types lowercase there, so the feedback names what is
// actually missing — it only counts once the learner taps "Trotzdem als
// richtig zählen" herself. Typos and accents stay out on purpose: in strict
// mode those are real mistakes.
export function isCaseOnlyMismatch(input: string, expected: string): boolean {
  const answer = input.trim();
  if (!answer) return false;
  return splitAlternatives(expected).some(
    (candidate) => candidate !== answer && candidate.toLowerCase() === answer.toLowerCase()
  );
}

export function isAnswerCorrect(
  input: string,
  expected: string,
  options?: { strict?: boolean }
): boolean {
  const candidates = splitAlternatives(expected);
  if (candidates.length === 0) return false;

  // Strict ("genau prüfen"): case, accents and spelling all count — but any one
  // of the listed alternatives, matched exactly, is still accepted.
  if (options?.strict) {
    const answer = input.trim();
    if (!answer) return false;
    return candidates.some((candidate) => candidate === answer);
  }

  // Forgiving: ignore case/accents/punctuation and tolerate small typos. The
  // typo budget scales with the *expected* answer's length (candidate), never the
  // input — so a long wrong guess can't buy extra tolerance: under 8 chars needs
  // an exact match, 8–15 allows one typo, 16+ allows two. That still accepts
  // "diagram" for "diagramm" while "haus" no longer accepts "maus".
  const answer = normalizeAnswer(input);
  if (!answer) return false;
  return candidates
    .map(normalizeAnswer)
    .filter((candidate) => candidate.length > 0)
    .some(
      (candidate) =>
        candidate === answer ||
        levenshtein(answer, candidate) <= Math.floor(candidate.length / 8)
    );
}
