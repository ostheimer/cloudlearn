import type { Flashcard } from "./contracts";

function splitIntoStudyLines(text: string): string[] {
  return text
    .split(/[.\n]/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 12)
    .slice(0, 10);
}

export function generateFlashcardsFromText(text: string, language: string): Flashcard[] {
  const lines = splitIntoStudyLines(text);
  const safeLines = lines.length > 0 ? lines : [text.slice(0, 120)];

  return safeLines.map((line, index) => {
    const prefix = language.startsWith("de") ? "Worum geht es in Aussage" : "What is the key point in statement";
    return {
      front: `${prefix} ${index + 1}?`,
      back: line,
      type: index % 3 === 0 ? "cloze" : "basic",
      difficulty: "medium",
      tags: ["auto-generated", language]
    };
  });
}
