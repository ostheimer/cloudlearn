import type { Flashcard } from "./contracts";
import { flashcardListSchema } from "./contracts";
import { generateFlashcardsFromText, generateFlashcardsFromImage } from "./flashcardGenerator";

/**
 * Generate flashcards from text with model fallback
 */
export function generateWithModelFallback(text: string, language: string): {
  cards: Flashcard[];
  model: string;
  fallbackUsed: boolean;
} {
  // For synchronous compatibility, use heuristic as primary
  // Real Gemini calls go through the async path
  const cards = flashcardListSchema.parse(generateFlashcardsFromTextSync(text, language));
  return {
    cards,
    model: "heuristic-fallback",
    fallbackUsed: false,
  };
}

/**
 * Async: Generate flashcards from text via Gemini API
 */
export async function generateFlashcardsAsync(
  text: string,
  language: string
): Promise<{ cards: Flashcard[]; model: string; fallbackUsed: boolean }> {
  try {
    const raw = await generateFlashcardsFromText(text, language);
    const cards = flashcardListSchema.parse(raw);
    return { cards, model: "gemini-3-flash", fallbackUsed: false };
  } catch (error) {
    // Fallback to heuristic
    const fallbackCards = generateFlashcardsFromTextSync(text, language);
    const cards = flashcardListSchema.parse(fallbackCards);
    return { cards, model: "heuristic-fallback", fallbackUsed: true };
  }
}

/**
 * Async: Generate flashcards from an image via Gemini Vision API
 */
export async function generateFlashcardsFromImageAsync(
  imageBase64: string,
  mimeType: string,
  language: string
): Promise<{ cards: Flashcard[]; model: string; fallbackUsed: boolean }> {
  const raw = await generateFlashcardsFromImage(imageBase64, mimeType, language);
  const cards = flashcardListSchema.parse(raw);
  return { cards, model: "gemini-3-flash-vision", fallbackUsed: false };
}

/**
 * Synchronous heuristic fallback for text → flashcards
 */
function generateFlashcardsFromTextSync(text: string, language: string): Flashcard[] {
  const lines = text
    .split(/[.\n]/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 12)
    .slice(0, 10);

  const safeLines = lines.length > 0 ? lines : [text.slice(0, 120)];

  return safeLines.map((line, index) => {
    const prefix = language.startsWith("de")
      ? "Worum geht es in Aussage"
      : "What is the key point in statement";
    return {
      front: `${prefix} ${index + 1}?`,
      back: line,
      type: index % 3 === 0 ? "cloze" : ("basic" as const),
      difficulty: "medium" as const,
      tags: ["auto-generated", language],
    };
  });
}
