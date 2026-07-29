// Turns a {{cN::…}} cloze into its display form: every gap becomes `blank`
// (default "______"), `clozeAnswer` is the first gap's solution. Text without
// a gap comes back unchanged. Mirrors formatCloze in the web's card-display.ts
// (#569/#592) — the raw markup must never reach a question, because it prints
// the answer inside the question text.

export function formatCloze(
  text: string,
  blank = "______"
): { display: string; clozeAnswer: string | null } {
  const match = text.match(/\{\{c\d+::(.+?)\}\}/);
  if (!match) return { display: text, clozeAnswer: null };
  const clozeAnswer = match[1] ?? null;
  const display = text.replace(/\{\{c\d+::.+?\}\}/g, blank);
  return { display, clozeAnswer };
}
