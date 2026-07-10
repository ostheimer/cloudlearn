// Nachsichtiger Freitext-Vergleich für den Lückentext-Modus (Port des
// gleichnamigen App-Helfers apps/mobile/src/lib/answerCheck.ts, damit Web und
// App identisch bewerten). „Nachsichtig" heißt: Dinge, für die man nicht als
// falsch gelten sollte, werden ignoriert:
//   - Groß-/Kleinschreibung
//   - Akzente / Diakritika (é -> e, ä -> a)
//   - umgebende Leerzeichen und Satzzeichen
//   - kleine Tippfehler (Editierdistanz, skaliert mit der Antwortlänge)
// Erwartete Antworten dürfen Alternativen mit "/", ";" oder "," auflisten —
// jede einzelne zählt. { strict: true } erzwingt exakte Übereinstimmung
// (Schreibung, Akzente, Rechtschreibung), akzeptiert aber weiter jede Alternative.

const DIACRITICS = /[̀-ͯ]/g;

export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICS, "") // kombinierende Akzente entfernen
    .toLowerCase()
    .replace(/[.,;:!?]/g, "") // Satzzeichen weglassen
    .replace(/\s+/g, " ")
    .trim();
}

// Standard-Levenshtein-Editierdistanz zwischen zwei Strings.
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
        prev[j]! + 1, // Löschen
        curr[j - 1]! + 1, // Einfügen
        prev[j - 1]! + cost // Ersetzen
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
}

// Antworten dürfen mehrere akzeptierte Varianten mit "/", ";" oder ","
// auflisten — z. B. "beispiellos, ohnegleichen". Jede einzelne zählt.
function splitAlternatives(expected: string): string[] {
  return [expected, ...expected.split(/[/;,]/)]
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > 0);
}

export function isAnswerCorrect(
  input: string,
  expected: string,
  options?: { strict?: boolean }
): boolean {
  const candidates = splitAlternatives(expected);
  if (candidates.length === 0) return false;

  // Streng ("genau prüfen"): Schreibung, Akzente und Rechtschreibung zählen —
  // aber jede der aufgelisteten Alternativen, exakt getippt, wird akzeptiert.
  if (options?.strict) {
    const answer = input.trim();
    if (!answer) return false;
    return candidates.some((candidate) => candidate === answer);
  }

  // Nachsichtig: Groß/klein, Akzente und Satzzeichen ignorieren, kleine
  // Tippfehler tolerieren. Die erlaubte Tippfehlerzahl wächst mit der Länge.
  const answer = normalizeAnswer(input);
  if (!answer) return false;
  return candidates
    .map(normalizeAnswer)
    .filter((candidate) => candidate.length > 0)
    .some(
      (candidate) =>
        candidate === answer ||
        (candidate.length >= 4 &&
          levenshtein(answer, candidate) <= Math.max(1, Math.floor(candidate.length / 8)))
    );
}
