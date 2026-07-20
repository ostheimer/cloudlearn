// The model does not scale card count with input length — it plateaus. Measured
// on one 30-page PIT PDF, asking for full coverage each time:
//
//    5 000 chars in -> ~22 cards   (4.33 cards per 1000 chars)
//   10 000 chars in -> ~26 cards   (2.57)
//   20 000 chars in -> ~34 cards   (1.70)
//   42 028 chars in -> ~33 cards   (0.79)
//
// Coverage per page therefore collapses as the document grows: a 30-page PDF and
// a 5-page PDF both yield ~33 cards. Raising the extraction cap alone would make
// this worse, spreading the same 33 cards over twice the material.
//
// Splitting the text and generating per chunk restores coverage. It is also
// cheaper per card than one big call, because the material is divided rather
// than duplicated — only the system prompt repeats. Measured on Themengebiet 7
// (18k chars, thinkingLevel low): one call gave 20 cards for 6388 tokens, three
// 8k chunks gave 60 cards for 11264 — 3x the cards for 1.8x the tokens.

const CHUNK_SIZE = 8_000;
// Below this a trailing chunk is a scrap that yields near-duplicate cards; fold
// it into the previous chunk instead.
const MIN_TAIL = 2_000;
// A sentence break is only worth taking in the last 40% of a chunk; earlier than
// that we would waste too much of the budget.
const EARLIEST_BREAK = 0.6;

/**
 * Split study text into chunks for separate generation calls.
 *
 * Chunks end on a sentence boundary where one is available, so a definition is
 * not cut in half across two calls. Text at or below one chunk is returned
 * unchanged — a single call, exactly as before.
 */
export function splitStudyText(text: string, chunkSize = CHUNK_SIZE): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= chunkSize) return trimmed ? [trimmed] : [];

  const chunks: string[] = [];
  let start = 0;
  while (start < trimmed.length) {
    let end = Math.min(start + chunkSize, trimmed.length);
    if (end < trimmed.length) {
      const sentenceEnd = trimmed.lastIndexOf(". ", end);
      if (sentenceEnd > start + chunkSize * EARLIEST_BREAK) end = sentenceEnd + 1;
    }
    // Absorb a short tail rather than emitting a scrap chunk.
    if (trimmed.length - end < MIN_TAIL) end = trimmed.length;
    chunks.push(trimmed.slice(start, end).trim());
    start = end;
  }
  return chunks.filter((chunk) => chunk.length > 0);
}

/**
 * Merge cards from several chunks, dropping near-duplicates.
 *
 * Chunks barely overlap in practice (measured: 0-1 duplicates across a whole
 * PDF), but a concept spanning a boundary can produce the same question twice.
 *
 * Keys on the WHOLE question, letters and digits only, so casing and punctuation
 * cannot hide a repeat. Deliberately not a prefix: two cards may share a long
 * opening and still ask different things ("Nenne die wichtigsten Anwendungen …
 * im Bereich Medizin" vs "… im Bereich Handel"), and losing a distinct card is
 * worse than keeping a near-duplicate.
 */
export function mergeChunkCards<T extends { front: string }>(groups: T[][], limit: number): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const group of groups) {
    for (const card of group) {
      const key = String(card.front).toLowerCase().replace(/[^a-zäöüß0-9]/g, "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(card);
      if (merged.length >= limit) return merged;
    }
  }
  return merged;
}
