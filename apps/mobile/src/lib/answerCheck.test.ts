import { describe, it, expect } from "vitest";
import {
  normalizeAnswer,
  levenshtein,
  isAnswerCorrect,
  isCaseOnlyMismatch,
} from "./answerCheck";

describe("isCaseOnlyMismatch — the yellow 'Fast' state (#610)", () => {
  it("detects a pure case mismatch, including alternatives", () => {
    expect(isCaseOnlyMismatch("hund", "Hund")).toBe(true);
    expect(isCaseOnlyMismatch("COUCH", "Couch/Sofa")).toBe(true);
    expect(isCaseOnlyMismatch("élève", "Élève")).toBe(true);
  });

  it("stays silent for exact or entirely different answers", () => {
    expect(isCaseOnlyMismatch("Hund", "Hund")).toBe(false);
    expect(isCaseOnlyMismatch("Katze", "Hund")).toBe(false);
  });

  it("typos and accents are no 'Fast' — real mistakes in strict mode", () => {
    expect(isCaseOnlyMismatch("hundd", "Hund")).toBe(false);
    expect(isCaseOnlyMismatch("cafe", "Café")).toBe(false);
  });

  it("empty input is no 'Fast'", () => {
    expect(isCaseOnlyMismatch("   ", "Hund")).toBe(false);
  });
});

describe("normalizeAnswer", () => {
  it("lowercases and trims", () => {
    expect(normalizeAnswer("  Die Hälfte ")).toBe("die halfte");
  });

  it("strips diacritics", () => {
    expect(normalizeAnswer("Café")).toBe("cafe");
    expect(normalizeAnswer("MOITIÉ")).toBe("moitie");
    expect(normalizeAnswer("Wärme")).toBe("warme");
  });

  it("drops sentence punctuation and collapses whitespace", () => {
    expect(normalizeAnswer("die   Wärme!")).toBe("die warme");
    expect(normalizeAnswer("a, b; c.")).toBe("a b c");
  });
});

describe("levenshtein", () => {
  it("computes edit distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("abc", "abc")).toBe(0);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("warme", "warmes")).toBe(1);
  });
});

describe("isAnswerCorrect", () => {
  it("accepts exact and case/accent variants", () => {
    expect(isAnswerCorrect("die Wärme", "die Wärme")).toBe(true);
    expect(isAnswerCorrect("die wärme", "die Wärme")).toBe(true);
    expect(isAnswerCorrect("cafe", "café")).toBe(true);
    expect(isAnswerCorrect("  die Hälfte  ", "die Hälfte")).toBe(true);
  });

  it("tolerates a single typo in longer words", () => {
    expect(isAnswerCorrect("diagram", "diagramm")).toBe(true); // one missing letter, 8-char answer
    expect(isAnswerCorrect("halfte", "Hälfte")).toBe(true); // umlaut dropped == exact
  });

  it("does not over-tolerate short words", () => {
    expect(isAnswerCorrect("de", "die")).toBe(false);
    expect(isAnswerCorrect("rot", "tot")).toBe(false);
    // Words under 8 chars need an exact match now — one substitution is wrong.
    expect(isAnswerCorrect("maus", "haus")).toBe(false);
    expect(isAnswerCorrect("haus", "haus")).toBe(true);
  });

  it("accepts any listed alternative", () => {
    expect(isAnswerCorrect("drei Viertel", "ein Viertel / drei Viertel")).toBe(true);
    expect(isAnswerCorrect("ein Viertel", "ein Viertel / drei Viertel")).toBe(true);
    expect(isAnswerCorrect("le chat", "le chat; die Katze")).toBe(true);
  });

  it("rejects wrong and empty answers", () => {
    expect(isAnswerCorrect("die Kälte", "die Wärme")).toBe(false);
    expect(isAnswerCorrect("", "die Wärme")).toBe(false);
    expect(isAnswerCorrect("   ", "die Wärme")).toBe(false);
  });

  it("accepts one of comma-separated answers", () => {
    expect(isAnswerCorrect("ohnegleichen", "beispiellos, ohnegleichen")).toBe(true);
    expect(isAnswerCorrect("beispiellos", "beispiellos, ohnegleichen")).toBe(true);
  });

  it("forgives a single missing letter in a longer answer", () => {
    // "Johan Peter Salomon" -> "Johann Peter Salomon" (one missing n)
    expect(isAnswerCorrect("johan peter salomon", "Johann Peter Salomon")).toBe(true);
  });
});

describe("isAnswerCorrect (strict)", () => {
  it("requires an exact match", () => {
    expect(isAnswerCorrect("der Rekord", "der Rekord", { strict: true })).toBe(true);
    expect(isAnswerCorrect("der rekord", "der Rekord", { strict: true })).toBe(false);
    expect(isAnswerCorrect("johan peter salomon", "Johann Peter Salomon", { strict: true })).toBe(
      false
    );
  });

  it("still accepts any one exact alternative", () => {
    expect(
      isAnswerCorrect("ohnegleichen", "beispiellos, ohnegleichen", { strict: true })
    ).toBe(true);
  });
});
